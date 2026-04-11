import { supabase } from '../lib/supabase.js'
import { translations } from '../lib/translations.js'

let products = []
let categories = []
let activeModal = null

export async function loadInventory(container) {
  const lang = localStorage.getItem('freshmart_lang') || 'en'
  const t = translations[lang]

  // Setup header actions
  const headerActions = document.getElementById('header-actions')
  headerActions.innerHTML = `
    <button id="manage-cats-btn" class="btn-secondary">
      <span>📁</span> ${t.manage_categories}
    </button>
    <button id="add-product-btn" class="btn-primary">
      <span>+</span> ${t.add_product}
    </button>
  `

  container.innerHTML = `
    <div class="card" style="margin-bottom: 1.5rem;">
      <div class="input-group" style="margin: 0; max-width: 400px; min-width: 280px;">
        <input type="text" id="search-product" placeholder="${t.search_placeholder}">
      </div>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>${t.product}</th>
            <th>${t.category}</th>
            <th>${t.sizes}</th>
            <th>${t.total}</th>
            <th>${t.status}</th>
            <th>${t.actions}</th>
          </tr>
        </thead>
        <tbody id="inventory-tbody">
          <tr><td colspan="6" style="text-align: center;">${t.loading}</td></tr>
        </tbody>
      </table>
    </div>
  `

  await fetchCategories()
  await fetchProducts()
  
  document.getElementById('add-product-btn').addEventListener('click', () => openProductModal())
  document.getElementById('manage-cats-btn').addEventListener('click', () => openCategoryModal())
  document.getElementById('search-product').addEventListener('input', (e) => renderTable(e.target.value))
}

async function fetchCategories() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'categories')
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching categories:', error)
    return
  }

  categories = data?.value || [
    { id: 'dairy', label: 'Dairy', emoji: '🥛' },
    { id: 'fruits', label: 'Fruits', emoji: '🍎' },
    { id: 'vegetables', label: 'Vegetables', emoji: '🥦' },
    { id: 'meat', label: 'Meat', emoji: '🥩' },
    { id: 'bakery', label: 'Bakery', emoji: '🥐' }
  ]
}

async function saveCategories() {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'categories', value: categories }, { onConflict: 'key' })

  if (error) alert('Failed to save categories: ' + error.message)
}

async function fetchProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    document.getElementById('inventory-tbody').innerHTML = `<tr><td colspan="6" class="error-text">Failed to load products</td></tr>`
    return
  }

  products = data || []
  renderTable()
}

function renderTable(searchQuery = '') {
  const tbody = document.getElementById('inventory-tbody')
  if (!tbody) return

  const lang = localStorage.getItem('freshmart_lang') || 'en'
  const t = translations[lang]
  
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (filteredProducts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No products found.</td></tr>`
    return
  }

  tbody.innerHTML = filteredProducts.map(p => {
    // Find min price and max discount percentage
    const minPrice = Math.min(...p.sizes.map(s => s.price))
    const discountedVariant = p.sizes.find(s => s.old_price > s.price)
    const discountPercent = discountedVariant ? Math.round((1 - discountedVariant.price / discountedVariant.old_price) * 100) : 0

    const catObj = categories.find(c => c.id === p.category)
    const catDisplay = catObj ? `${catObj.emoji} ${catObj.label}` : p.category

    return `
    <tr>
      <td>
        <div class="product-cell">
          ${p.image_url ? 
            `<img src="${p.image_url}" class="product-img">` : 
            `<span class="product-emoji">${p.emoji}</span>`
          }
          <div class="product-info">
            <div class="product-name">${p.name}</div>
            <div class="product-badge-text">
              ${discountPercent > 0 ? `<span class="discount-badge">-${discountPercent}%</span> ` : ''}
              ${p.badge || '—'}
            </div>
          </div>
        </div>
      </td>
      <td style="text-transform: capitalize;"><span class="status-badge" style="background: #f1f5f9; color: #475569;">${catDisplay}</span></td>
      <td style="font-size: 0.75rem; color: var(--text-muted);">${p.sizes.length} variant(s)</td>
      <td>
        <div style="font-weight: 700;">€${minPrice.toFixed(2)}</div>
        ${discountedVariant ? `<div class="old-price">€${discountedVariant.old_price.toFixed(2)}</div>` : ''}
      </td>
      <td>
        <button class="status-btn" data-id="${p.id}" data-active="${p.is_active}" style="background:none; border:none; cursor:pointer;">
          <span class="status-badge ${p.is_active ? 'status-active' : 'status-inactive'}">
            ${p.is_active ? 'Active' : 'Inactive'}
          </span>
        </button>
      </td>
      <td>
        <div class="action-row">
          <button class="btn-secondary edit-btn" data-id="${p.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">${t.edit}</button>
          <button class="btn-secondary delete-btn" data-id="${p.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: var(--error);">${t.delete}</button>
        </div>
      </td>
    </tr>
  `}).join('')

  // Attach events
  tbody.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = btn.dataset.id
      const currentStatus = btn.dataset.active === 'true'
      await toggleStatus(id, !currentStatus)
    })
  })

  tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const product = products.find(p => p.id === btn.dataset.id)
      openProductModal(product)
    })
  })

  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id
      const product = products.find(p => p.id === id)
      if (confirm(`Are you sure you want to delete "${product.name}"?`)) {
        await deleteProduct(id)
      }
    })
  })
}

async function deleteProduct(id) {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (!error) {
    products = products.filter(p => p.id !== id)
    renderTable()
  } else {
    alert(`Failed to delete: ${error.message}`)
  }
}

async function toggleStatus(id, newStatus) {
  const btn = document.querySelector(`.status-btn[data-id="${id}"]`)
  btn.style.opacity = '0.5'

  const { error } = await supabase
    .from('products')
    .update({ is_active: newStatus })
    .eq('id', id)

  if (!error) {
    const pIndex = products.findIndex(p => p.id === id)
    if (pIndex > -1) products[pIndex].is_active = newStatus
    renderTable()
  } else {
    btn.style.opacity = '1'
    alert('Failed to update status')
  }
}

function openCategoryModal() {
  const lang = localStorage.getItem('freshmart_lang') || 'en'
  const t = translations[lang]

  const modalHtml = `
    <div class="modal-overlay" id="cat-modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>${t.manage_categories}</h3>
          <button id="close-cat-modal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-grid" style="grid-template-columns: 1fr 1fr 80px auto; margin-bottom: 1rem; align-items: flex-end; gap: 0.5rem;">
            <div class="input-group" style="margin:0;">
              <label style="font-size: 0.75rem;">ID</label>
              <input type="text" id="new-cat-id" placeholder="e.g. dairy">
            </div>
            <div class="input-group" style="margin:0;">
              <label style="font-size: 0.75rem;">Label</label>
              <input type="text" id="new-cat-label" placeholder="e.g. Dairy">
            </div>
            <div class="input-group" style="margin:0;">
              <label style="font-size: 0.75rem;">Emoji</label>
              <input type="text" id="new-cat-emoji" placeholder="🥛">
            </div>
            <button id="add-cat-btn" class="btn-primary" style="height: 48px; min-width: 48px; margin-bottom: 0;">+</button>
          </div>
          <div id="cats-list" class="categories-container" style="display: flex; flex-direction: column; gap: 0.5rem;"></div>
        </div>
        <div class="modal-footer">
          <button id="close-cat-footer" class="btn-secondary">${t.cancel}</button>
        </div>
      </div>
    </div>
  `

  document.body.insertAdjacentHTML('beforeend', modalHtml)
  const renderCats = () => {
    const container = document.getElementById('cats-list')
    container.innerHTML = categories.map((c, i) => `
      <div style="display: flex; justify-content: space-between; align-items: center; background: var(--surface-hover); padding: 0.5rem 1rem; border-radius: var(--radius-md);">
        <div style="font-weight: 500; display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.25rem;">${c.emoji || '📦'}</span>
          <span>${c.label}</span>
          <span style="color: var(--text-muted); font-size: 0.75rem; font-family: monospace;">(${c.id})</span>
        </div>
        <button class="btn-icon" onclick="removeCategory(${i})" style="color: var(--error); font-size: 1.25rem;">&times;</button>
      </div>
    `).join('')
  }

  window.removeCategory = async (i) => {
    categories.splice(i, 1)
    renderCats()
    await saveCategories()
  }

  renderCats()

  document.getElementById('add-cat-btn').addEventListener('click', async () => {
    const idInput = document.getElementById('new-cat-id')
    const labelInput = document.getElementById('new-cat-label')
    const emojiInput = document.getElementById('new-cat-emoji')
    
    const idVal = idInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    const labelVal = labelInput.value.trim()
    const emojiVal = emojiInput.value.trim() || '🛒'

    if (idVal && labelVal && !categories.find(c => c.id === idVal)) {
      categories.push({ id: idVal, label: labelVal, emoji: emojiVal })
      idInput.value = ''
      labelInput.value = ''
      emojiInput.value = ''
      renderCats()
      await saveCategories()
    } else {
      alert("Please provide a valid, unique ID and a Label.")
    }
  })

  const close = () => {
    document.getElementById('cat-modal-overlay').remove()
    delete window.removeCategory
  }
  document.getElementById('close-cat-modal').addEventListener('click', close)
  document.getElementById('close-cat-footer').addEventListener('click', close)
}

function openProductModal(product = null) {
  const isEdit = !!product
  const lang = localStorage.getItem('freshmart_lang') || 'en'
  const t = translations[lang]
  
  const modalHtml = `
    <div class="modal-overlay" id="product-modal-overlay">
      <div class="modal" style="max-width: 720px;">
        <div class="modal-header">
          <h3>${isEdit ? t.edit : t.add_product}</h3>
          <button id="close-modal-top" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="product-form">
            <div class="form-grid">
              <div class="input-group">
                <label>${t.user_name}</label>
                <input type="text" name="name" required value="${product?.name || ''}">
              </div>
              <div class="input-group">
                <label>${t.category}</label>
                <select name="category" required class="form-textarea" style="min-height: 48px; padding: 0.5rem 1rem;">
                  ${categories.map(c => `<option value="${c.id}" ${product?.category === c.id ? 'selected' : ''}>${c.emoji || ''} ${c.label || c.id}</option>`).join('')}
                </select>
              </div>
            </div>
            
            <div class="form-grid-image">
              <div class="input-group">
                <label>Emoji</label>
                <input type="text" name="emoji" required value="${product?.emoji || '🛒'}">
              </div>
              <div class="input-group">
                <label>${t.product} Image</label>
                <input type="file" id="product-image-input" accept="image/*" class="file-input">
                <input type="hidden" name="image_url" value="${product?.image_url || ''}">
              </div>
            </div>

            <div class="input-group">
              <label>Badge</label>
              <input type="text" name="badge" value="${product?.badge || ''}" placeholder="e.g. Best Seller">
            </div>

            <div class="input-group">
              <label>Description</label>
              <textarea name="description" required class="form-textarea">${product?.description || ''}</textarea>
            </div>

            <hr style="border: none; border-top: 1px solid var(--border); margin: 1.5rem 0;">
            
            <div class="variants-header">
              <label>${t.sizes}</label>
              <button type="button" id="add-variant-btn" class="btn-secondary variant-btn">+ ${t.actions}</button>
            </div>
            
            <div id="variants-container"></div>
            
            <input type="hidden" name="id" value="${product?.id || ''}">
          </form>
        </div>
        <div class="modal-footer">
          <button id="close-modal-bottom" class="btn-secondary">${t.cancel}</button>
          <button form="product-form" type="submit" class="btn-primary" style="width: auto; min-width: 140px;">${t.save}</button>
        </div>
      </div>
    </div>
  `

  document.body.insertAdjacentHTML('beforeend', modalHtml)
  activeModal = document.getElementById('product-modal-overlay')

  let variants = product?.sizes || [{ label: '', price: 0, old_price: null }]
  const variantsContainer = document.getElementById('variants-container')
  
  const renderVariants = () => {
    variantsContainer.innerHTML = variants.map((v, i) => `
      <div class="variant-item" style="grid-template-columns: 1fr 100px 100px auto;">
        <input type="text" placeholder="Label" value="${v.label}" onchange="updateVariant(${i}, 'label', this.value)" required>
        <input type="number" step="0.01" placeholder="Price" value="${v.price}" onchange="updateVariant(${i}, 'price', this.value)" required>
        <input type="number" step="0.01" placeholder="Was" value="${v.old_price || ''}" onchange="updateVariant(${i}, 'old_price', this.value)">
        <button type="button" onclick="removeVariant(${i})" class="btn-icon" ${variants.length === 1 ? 'disabled' : ''}>&times;</button>
      </div>
    `).join('')
  }
  
  window.updateVariant = (idx, field, val) => {
    if (field === 'price' || field === 'old_price') {
      variants[idx][field] = val ? parseFloat(val) : null
    } else {
      variants[idx][field] = val
    }
  }
  window.removeVariant = (idx) => {
    if (variants.length > 1) {
      variants.splice(idx, 1)
      renderVariants()
    }
  }

  document.getElementById('add-variant-btn').addEventListener('click', () => {
    variants.push({ label: '', price: 0, old_price: null })
    renderVariants()
  })

  renderVariants()

  const closeModal = () => {
    activeModal.remove()
    activeModal = null
    delete window.updateVariant
    delete window.removeVariant
  }

  document.getElementById('close-modal-top').addEventListener('click', closeModal)
  document.getElementById('close-modal-bottom').addEventListener('click', closeModal)

  document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    if (variants.some(v => !v.label || v.price <= 0)) {
      alert("Please ensure all variants have a label and price > 0")
      return;
    }

    const formData = new FormData(e.target)
    const fileInput = document.getElementById('product-image-input')
    const file = fileInput.files[0]
    let image_url = formData.get('image_url')

    const submitBtn = document.querySelector('button[form="product-form"]')
    submitBtn.textContent = '...'
    submitBtn.disabled = true

    if (file) {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
      const { data: uploadData, error: uploadError } = await supabase.storage.from('product-images').upload(fileName, file)
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName)
        image_url = publicUrl
      }
    }

    const payload = {
      name: formData.get('name'),
      category: formData.get('category'),
      emoji: formData.get('emoji'),
      badge: formData.get('badge') || null,
      description: formData.get('description'),
      image_url: image_url,
      sizes: variants,
      default_size: 0
    }

    const id = formData.get('id')
    let dbError = null

    if (id) {
      const { error } = await supabase.from('products').update(payload).eq('id', id)
      dbError = error
    } else {
      const { error } = await supabase.from('products').insert([payload])
      dbError = error
    }

    if (dbError) {
      alert(`Error: ${dbError.message}`)
      submitBtn.disabled = false
      submitBtn.textContent = t.save
    } else {
      closeModal()
      fetchProducts()
    }
  })
}
