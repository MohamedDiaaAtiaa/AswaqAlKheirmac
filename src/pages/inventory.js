import { supabase } from '../lib/supabase.js'
import { translations } from '../lib/translations.js'
import { Dialog } from '../lib/dialog.js'
let products = []
let categories = []
let activeModal = null
let isSouqMode = false

export async function loadInventory(container, isSouq = false) {
  isSouqMode = isSouq
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  // Setup header
  const headerActions = document.getElementById('header-actions')
  if (isSouqMode) {
    headerActions.innerHTML = `
      <button id="add-product-btn" class="btn-primary">
        <span>+</span> ${t.add_product}
      </button>
    `
    document.getElementById('add-product-btn').addEventListener('click', () => openEditModal())
  } else {
    headerActions.innerHTML = `
      <button id="pick-from-souq-btn" class="btn-primary">
        <span>🛒</span> ${t.select_from_souq}
      </button>
    `
    document.getElementById('pick-from-souq-btn').addEventListener('click', () => openSouqPickerModal())
  }

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
            <th>${t.stock}</th>
            <th>${t.status}</th>
            <th>${t.actions}</th>
          </tr>
        </thead>
        <tbody id="inventory-tbody">
          <tr><td colspan="7" style="text-align: center;">${t.loading}</td></tr>
        </tbody>
      </table>
    </div>
  `

  await fetchCategories()
  await fetchProducts()
  
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
    { id: 'dairy', label_ar: 'ألبان', label_en: 'Dairy', emoji: '🥛' },
    { id: 'fruits', label_ar: 'فواكه', label_en: 'Fruits', emoji: '🍎' },
    { id: 'vegetables', label_ar: 'خضروات', label_en: 'Vegetables', emoji: '🥦' },
    { id: 'meat', label_ar: 'لحوم', label_en: 'Meat', emoji: '🥩' },
    { id: 'bakery', label_ar: 'مخبوزات', label_en: 'Bakery', emoji: '🥐' }
  ]
}

async function saveCategories() {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'categories', value: categories }, { onConflict: 'key' })

  if (error) await Dialog.alert('Failed to save categories: ' + error.message)
}

async function fetchProducts() {
  const currentBranchId = localStorage.getItem('aswaq_branch_id')
  
  let queryActive = supabase.from('products').select('*').order('created_at', { ascending: false })
  let queryOOS = supabase.from('out_of_stock_products').select('*').order('created_at', { ascending: false })

  if (isSouqMode) {
    queryActive = queryActive.is('branch_id', null)
    queryOOS = queryOOS.is('branch_id', null)
  } else {
    queryActive = queryActive.eq('branch_id', currentBranchId)
    queryOOS = queryOOS.eq('branch_id', currentBranchId)
  }

  const { data: active, error: err1 } = await queryActive
  const { data: outOfStock, error: err2 } = await queryOOS

  if (err1 && err1.code !== 'PGRST116' && err1.code !== '42P01') console.error('Error fetching products:', err1)
  if (err2 && err2.code !== 'PGRST116' && err2.code !== '42P01') console.error('Error fetching out of stock:', err2)

  products = [
    ...(active || []).map(p => ({ ...p, _table: 'products' })),
    ...(outOfStock || []).map(p => ({ ...p, _table: 'out_of_stock_products' }))
  ]
  
  products.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  renderTable()
}

/** Helper to get the display name based on current language */
function getProductName(product) {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  if (lang === 'ar') {
    return product.name_ar || product.name || ''
  }
  return product.name_en || product.name || ''
}

/** Helper to get category display label */
function getCategoryLabel(catObj) {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  if (!catObj) return ''
  if (lang === 'ar') {
    return catObj.label_ar || catObj.label || catObj.id
  }
  return catObj.label_en || catObj.label || catObj.id
}

function renderTable(searchQuery = '') {
  const tbody = document.getElementById('inventory-tbody')
  if (!tbody) return

  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]
  
  const filteredProducts = products.filter(p => {
    const nameAr = (p.name_ar || p.name || '').toLowerCase()
    const nameEn = (p.name_en || '').toLowerCase()
    const cat = (p.category || '').toLowerCase()
    const q = searchQuery.toLowerCase()
    return nameAr.includes(q) || nameEn.includes(q) || cat.includes(q)
  })

  if (filteredProducts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">${t.no_products}</td></tr>`
    return
  }

  tbody.innerHTML = filteredProducts.map(p => {
    // Find min price and max discount percentage
    const minPrice = Math.min(...p.sizes.map(s => s.price))
    const discountedVariant = p.sizes.find(s => s.old_price > s.price)
    const discountPercent = discountedVariant ? Math.round((1 - discountedVariant.price / discountedVariant.old_price) * 100) : 0

    const catObj = categories.find(c => c.id === p.category)
    const catLabel = getCategoryLabel(catObj)
    const catDisplay = catObj ? `${catObj.emoji} ${catLabel}` : p.category

    const displayName = getProductName(p)

    return `
    <tr>
      <td>
        <div class="product-cell">
          ${p.image_url ? 
            `<img src="${p.image_url}" class="product-img">` : 
            `<span class="product-emoji">${p.emoji}</span>`
          }
          <div class="product-info">
            <div class="product-name">${displayName}</div>
            <div class="product-badge-text">
              ${discountPercent > 0 ? `<span class="discount-badge">-${discountPercent}%</span> ` : ''}
              ${p.badge || '—'}
            </div>
          </div>
        </div>
      </td>
      <td style="text-transform: capitalize;"><span class="status-badge" style="background: #f1f5f9; color: #475569;">${catDisplay}</span></td>
      <td style="font-size: 0.75rem; color: var(--text-muted);">${p.sizes.length} ${t.variants_count}</td>
      <td>
        <div style="font-weight: 700;">€${minPrice.toFixed(2)}</div>
        ${discountedVariant ? `<div class="old-price">€${discountedVariant.old_price.toFixed(2)}</div>` : ''}
      </td>
      <td>
        <div class="stock-manager">
          <button class="stock-btn minus" data-id="${p.id}" data-table="${p._table}">-</button>
          <input type="text" inputmode="decimal" class="stock-input" value="${p.stock || 0}" data-id="${p.id}" data-table="${p._table}">
          <button class="stock-btn plus" data-id="${p.id}" data-table="${p._table}">+</button>
          <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 0.5rem; font-weight: 600;">${p.unit ? t['unit_' + p.unit] || p.unit : t.unit_item}</span>
        </div>
      </td>
      <td>
        <button class="status-btn" data-id="${p.id}" data-table="${p._table}" data-active="${p.is_active}" style="background:none; border:none; cursor:pointer;">
          <span class="status-badge ${p.is_active ? 'status-active' : 'status-inactive'}">
            ${p.is_active ? t.active : t.inactive}
          </span>
        </button>
      </td>
      <td>
        <div class="action-row">
          <button class="btn-secondary edit-btn" data-id="${p.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">${t.edit}</button>
          <button class="btn-secondary delete-btn" data-id="${p.id}" data-table="${p._table}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: var(--error); border-color: var(--error);">${t.delete || 'Delete'}</button>
        </div>
      </td>
    </tr>
  `}).join('')

  // Attach events
  tbody.querySelectorAll('.stock-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id
      const table = btn.dataset.table
      const delta = btn.classList.contains('plus') ? 1 : -1
      const product = products.find(p => p.id === id)
      const newStock = Math.max(0, (product.stock || 0) + delta)
      await updateStock(id, table, newStock)
    })
  })

  tbody.querySelectorAll('.stock-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    });
    input.addEventListener('change', async () => {
      const id = input.dataset.id
      const table = input.dataset.table
      let val = String(input.value).replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 1776)
      const newStock = Math.max(0, parseInt(val) || 0)
      await updateStock(id, table, newStock)
    })
  })

  tbody.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = btn.dataset.id
      const table = btn.dataset.table
      const currentStatus = btn.dataset.active === 'true'
      await toggleStatus(id, table, !currentStatus)
    })
  })

  tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const product = products.find(p => p.id === btn.dataset.id)
      if (isSouqMode) {
        openEditModal(product)
      } else {
        openPriceEditModal(product)
      }
    })
  })

  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm(t.confirm_delete || 'Are you sure you want to delete this product?')) {
        const id = btn.dataset.id
        const table = btn.dataset.table
        await deleteProduct(id, table)
      }
    })
  })
}

async function openSouqPickerModal() {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]
  const currentBranchId = localStorage.getItem('aswaq_branch_id')

  // Fetch Souq products
  const { data: souqProducts, error } = await supabase
    .from('products')
    .select('*')
    .is('branch_id', null)
    .gt('stock', 0)

  if (error) return Dialog.alert('Error fetching Souq: ' + error.message)

  const modalHtml = `
    <div class="modal-overlay" id="souq-picker-overlay">
      <div class="modal" style="max-width: 500px;">
        <div class="modal-header">
          <h3>${t.select_from_souq}</h3>
          <button id="close-souq-picker" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="input-group">
            <label>${t.product}</label>
            <select id="souq-product-select" class="form-select" style="width:100%; padding:0.5rem;">
              ${souqProducts.map(p => `<option value="${p.id}">${getProductName(p)} (${p.stock} ${t['unit_'+p.unit]||p.unit})</option>`).join('')}
            </select>
          </div>
          <div class="input-group">
            <label>${t.qty}</label>
            <input type="number" id="souq-take-qty" min="1" value="1" style="width:100%;">
          </div>
          <div class="input-group">
            <label>${t.price}</label>
            <input type="number" step="0.01" id="souq-take-price" min="0" style="width:100%;">
          </div>
        </div>
        <div class="modal-footer">
          <button id="cancel-souq-picker" class="btn-secondary">${t.cancel}</button>
          <button id="confirm-souq-take" class="btn-primary">${t.save}</button>
        </div>
      </div>
    </div>
  `

  document.body.insertAdjacentHTML('beforeend', modalHtml)
  const overlay = document.getElementById('souq-picker-overlay')
  const selectEl = document.getElementById('souq-product-select')
  const priceInput = document.getElementById('souq-take-price')

  // Auto-fill price based on selection
  const updatePriceInput = () => {
    const p = souqProducts.find(x => x.id === selectEl.value)
    if (p && p.sizes && p.sizes[0]) priceInput.value = p.sizes[0].price
  }
  selectEl.addEventListener('change', updatePriceInput)
  if (souqProducts.length > 0) updatePriceInput()

  document.getElementById('close-souq-picker').addEventListener('click', () => overlay.remove())
  document.getElementById('cancel-souq-picker').addEventListener('click', () => overlay.remove())

  document.getElementById('confirm-souq-take').addEventListener('click', async () => {
    const productId = selectEl.value
    const qty = parseInt(document.getElementById('souq-take-qty').value) || 0
    const newPrice = parseFloat(priceInput.value) || 0
    const souqProduct = souqProducts.find(p => p.id === productId)

    if (qty > souqProduct.stock) return Dialog.alert('Not enough stock in Souq!')

    const confirmBtn = document.getElementById('confirm-souq-take')
    confirmBtn.disabled = true
    confirmBtn.textContent = t.saving

    // 1. Subtract from Souq
    const { error: subErr } = await supabase
      .from('products')
      .update({ stock: souqProduct.stock - qty })
      .eq('id', productId)

    if (subErr) {
      Dialog.alert('Error: ' + subErr.message)
      confirmBtn.disabled = false
      return
    }

    if (souqProduct.stock - qty <= 0) {
      await Dialog.alert(t.souq_stock_alert || 'Alert: Product is out of stock in Main Souq!')
    }

    // 2. Add to Branch
    const { data: existing } = await supabase
      .from('products')
      .select('*')
      .eq('branch_id', currentBranchId)
      .eq('parent_product_id', productId)
      .single()

    if (existing) {
      const updatedSizes = [...existing.sizes]
      if (updatedSizes.length > 0) updatedSizes[0].price = newPrice
      else updatedSizes.push({ label: 'Default', price: newPrice, old_price: null })

      await supabase.from('products').update({ 
        stock: existing.stock + qty,
        sizes: updatedSizes
      }).eq('id', existing.id)
    } else {
      const newProduct = { ...souqProduct }
      delete newProduct.id
      delete newProduct.created_at
      delete newProduct.updated_at
      newProduct.branch_id = currentBranchId
      newProduct.parent_product_id = productId
      newProduct.stock = qty
      
      const newSizes = [...(newProduct.sizes || [])]
      if (newSizes.length > 0) newSizes[0].price = newPrice
      else newSizes.push({ label: 'Default', price: newPrice, old_price: null })
      newProduct.sizes = newSizes

      await supabase.from('products').insert([newProduct])
    }

    overlay.remove()
    fetchProducts()
  })
}

function openEditModal(product = null) {
  const isEdit = !!product
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  let variants = product ? [...product.sizes] : [{ label: 'Default', price: 0, old_price: null }]

  const modalHtml = `
    <div class="modal-overlay" id="product-full-modal-overlay">
      <div class="modal" style="max-width: 600px;">
        <div class="modal-header">
          <h3>${isEdit ? t.edit : t.add_product}</h3>
          <button id="close-full-modal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="product-full-form">
            <div class="form-grid">
              <div class="input-group">
                <label>${t.product_name_ar}</label>
                <input type="text" name="name_ar" required value="${product?.name_ar || ''}">
              </div>
              <div class="input-group">
                <label>${t.product_name_en}</label>
                <input type="text" name="name_en" value="${product?.name_en || ''}">
              </div>
            </div>
            <div class="form-grid">
              <div class="input-group">
                <label>${t.category}</label>
                <select name="category">
                  ${categories.map(c => `<option value="${c.id}" ${product?.category === c.id ? 'selected' : ''}>${getCategoryLabel(c)}</option>`).join('')}
                </select>
              </div>
              <div class="input-group">
                <label>${t.unit}</label>
                <select name="unit">
                  <option value="item" ${product?.unit === 'item' ? 'selected' : ''}>${t.unit_item}</option>
                  <option value="kg" ${product?.unit === 'kg' ? 'selected' : ''}>${t.unit_kg}</option>
                  <option value="g" ${product?.unit === 'g' ? 'selected' : ''}>${t.unit_g}</option>
                  <option value="l" ${product?.unit === 'l' ? 'selected' : ''}>${t.unit_l}</option>
                  <option value="ml" ${product?.unit === 'ml' ? 'selected' : ''}>${t.unit_ml}</option>
                </select>
              </div>
            </div>
            <div class="form-grid">
              <div class="input-group">
                <label>${t.stock}</label>
                <input type="number" name="stock" required value="${product?.stock || 0}">
              </div>
              <div class="input-group">
                <label>${t.emoji}</label>
                <input type="text" name="emoji" value="${product?.emoji || '🛒'}">
              </div>
            </div>
            <hr>
            <div id="full-variants-container"></div>
            <button type="button" id="add-variant-btn" class="btn-secondary" style="margin-top:0.5rem;">+ ${t.add_variant}</button>
          </form>
        </div>
        <div class="modal-footer">
          <button id="cancel-full-modal" class="btn-secondary">${t.cancel}</button>
          <button form="product-full-form" type="submit" class="btn-primary">${t.save}</button>
        </div>
      </div>
    </div>
  `

  document.body.insertAdjacentHTML('beforeend', modalHtml)
  const overlay = document.getElementById('product-full-modal-overlay')
  const variantsContainer = document.getElementById('full-variants-container')

  const renderVariants = () => {
    variantsContainer.innerHTML = variants.map((v, i) => `
      <div class="variant-item" style="display:flex; gap:0.5rem; margin-bottom:0.5rem;">
        <input type="text" placeholder="Label" value="${v.label}" onchange="updateFullVariant(${i}, 'label', this.value)" style="flex:2;">
        <input type="number" step="0.01" placeholder="Price" value="${v.price}" onchange="updateFullVariant(${i}, 'price', this.value)" style="flex:1;">
        <button type="button" class="btn-icon" onclick="removeFullVariant(${i})" style="color:var(--error);">&times;</button>
      </div>
    `).join('')
  }

  window.updateFullVariant = (idx, field, val) => {
    if (field === 'price') {
      let numVal = String(val).replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 1776);
      variants[idx][field] = parseFloat(numVal) || 0;
    } else {
      variants[idx][field] = val;
    }
  }
  window.removeFullVariant = (idx) => {
    variants.splice(idx, 1)
    renderVariants()
  }

  renderVariants()

  document.getElementById('add-variant-btn').addEventListener('click', () => {
    variants.push({ label: '', price: 0, old_price: null })
    renderVariants()
  })

  document.getElementById('close-full-modal').addEventListener('click', () => overlay.remove())
  document.getElementById('cancel-full-modal').addEventListener('click', () => overlay.remove())

  document.getElementById('product-full-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const payload = {
      name: formData.get('name_ar'),
      name_ar: formData.get('name_ar'),
      name_en: formData.get('name_en'),
      category: formData.get('category'),
      unit: formData.get('unit'),
      stock: parseInt(String(formData.get('stock')).replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 1776)) || 0,
      emoji: formData.get('emoji'),
      sizes: variants,
      branch_id: null // Explicitly null for Souq
    }

    const { error } = isEdit ? await supabase.from('products').update(payload).eq('id', product.id) : await supabase.from('products').insert([payload])

    if (!error) {
      overlay.remove()
      fetchProducts()
    } else {
      Dialog.alert('Error: ' + error.message)
    }
  })
}

async function updateStock(id, table, newStock) {
  const { error } = await supabase
    .from(table)
    .update({ stock: newStock })
    .eq('id', id)

  if (!error) {
    const pIndex = products.findIndex(p => p.id === id)
    if (pIndex > -1) products[pIndex].stock = newStock
    // If triggers move it, we should probably refetch to be safe
    await fetchProducts()
  } else {
    await Dialog.alert('Failed to update stock: ' + error.message)
    renderTable()
  }
}

async function deleteProduct(id, table) {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)

  if (!error) {
    products = products.filter(p => p.id !== id)
    renderTable()
  } else {
    await Dialog.alert(`Failed to delete: ${error.message}`)
  }
}

async function toggleStatus(id, table, newStatus) {
  const { error } = await supabase
    .from(table)
    .update({ is_active: newStatus })
    .eq('id', id)

  if (!error) {
    const pIndex = products.findIndex(p => p.id === id)
    if (pIndex > -1) products[pIndex].is_active = newStatus
    renderTable()
  } else {
    await Dialog.alert('Failed to update status')
  }
}

function openCategoryModal() {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  const modalHtml = `
    <div class="modal-overlay" id="cat-modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>${t.manage_categories}</h3>
          <button id="close-cat-modal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-grid" style="grid-template-columns: 1fr 1fr 1fr 80px auto; margin-bottom: 1rem; align-items: flex-end; gap: 0.5rem;">
            <div class="input-group" style="margin:0;">
              <label style="font-size: 0.75rem;">${t.id_label}</label>
              <input type="text" id="new-cat-id" placeholder="dairy">
            </div>
            <div class="input-group" style="margin:0;">
              <label style="font-size: 0.75rem;">${t.category_label_ar}</label>
              <input type="text" id="new-cat-label-ar" placeholder="ألبان">
            </div>
            <div class="input-group" style="margin:0;">
              <label style="font-size: 0.75rem;">${t.category_label_en}</label>
              <input type="text" id="new-cat-label-en" placeholder="Dairy">
            </div>
            <div class="input-group" style="margin:0;">
              <label style="font-size: 0.75rem;">${t.emoji}</label>
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
          <span>${getCategoryLabel(c)}</span>
          <span style="color: var(--text-muted); font-size: 0.7rem;">(${c.label_ar || ''} / ${c.label_en || ''})</span>
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
    const labelArInput = document.getElementById('new-cat-label-ar')
    const labelEnInput = document.getElementById('new-cat-label-en')
    const emojiInput = document.getElementById('new-cat-emoji')
    
    const idVal = idInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    const labelArVal = labelArInput.value.trim()
    const labelEnVal = labelEnInput.value.trim()
    const emojiVal = emojiInput.value.trim() || '🛒'

    if (idVal && (labelArVal || labelEnVal) && !categories.find(c => c.id === idVal)) {
      categories.push({ id: idVal, label_ar: labelArVal, label_en: labelEnVal, emoji: emojiVal })
      idInput.value = ''
      labelArInput.value = ''
      labelEnInput.value = ''
      emojiInput.value = ''
      renderCats()
      await saveCategories()
    } else {
      await Dialog.alert(t.error_unique_id)
    }
  })

  const close = () => {
    document.getElementById('cat-modal-overlay').remove()
    delete window.removeCategory
  }
  document.getElementById('close-cat-modal').addEventListener('click', close)
  document.getElementById('close-cat-footer').addEventListener('click', close)
}

function openPriceEditModal(product) {
  if (!product) return
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]
  const displayName = getProductName(product)

  let variants = [...product.sizes]

  const modalHtml = `
    <div class="modal-overlay" id="product-modal-overlay">
      <div class="modal" style="max-width: 560px;">
        <div class="modal-header">
          <h3>${t.edit}: ${displayName}</h3>
          <button id="close-modal-top" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="product-form">
            <div class="input-group">
              <label>${t.stock}</label>
              <input type="number" name="stock" required value="${product.stock || 0}" style="max-width: 200px;">
              <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem; display: block;">${product.unit ? t['unit_' + product.unit] || product.unit : t.unit_item}</span>
            </div>

            <hr style="border: none; border-top: 1px solid var(--border); margin: 1.5rem 0;">

            <div class="variants-header">
              <label>${t.sizes} / ${t.price}</label>
            </div>
            <div id="variants-container"></div>

            <input type="hidden" name="id" value="${product.id}">
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

  const variantsContainer = document.getElementById('variants-container')

  const renderVariants = () => {
    variantsContainer.innerHTML = variants.map((v, i) => `
      <div class="variant-item" style="grid-template-columns: 1fr 100px 100px;">
        <div style="display: flex; align-items: center; font-weight: 600; padding: 0 0.5rem;">${v.label}</div>
        <input type="number" step="0.01" placeholder="${t.price}" value="${v.price}" onchange="updateVariant(${i}, 'price', this.value)" required>
        <input type="number" step="0.01" placeholder="${t.was}" value="${v.old_price || ''}" onchange="updateVariant(${i}, 'old_price', this.value)">
      </div>
    `).join('')
  }

  window.updateVariant = (idx, field, val) => {
    if (field === 'price' || field === 'old_price') {
      if (!val) {
        variants[idx][field] = null;
      } else {
        let numVal = String(val).replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 1776);
        variants[idx][field] = parseFloat(numVal) || null;
      }
    }
  }

  renderVariants()

  const closeModal = () => {
    activeModal.remove()
    activeModal = null
    delete window.updateVariant
  }

  document.getElementById('close-modal-top').addEventListener('click', closeModal)
  document.getElementById('close-modal-bottom').addEventListener('click', closeModal)

  document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    if (variants.some(v => v.price <= 0)) {
      await Dialog.alert(t.error_variants)
      return
    }

    const formData = new FormData(e.target)
    const submitBtn = document.querySelector('button[form="product-form"]')
    submitBtn.textContent = t.saving
    submitBtn.disabled = true

    const payload = {
      stock: parseInt(String(formData.get('stock')).replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 1776)) || 0,
      sizes: variants
    }

    const id = formData.get('id')
    const table = product._table || 'products'

    const { error } = await supabase.from(table).update(payload).eq('id', id)

    if (error) {
      await Dialog.alert(`Error: ${error.message}`)
      submitBtn.disabled = false
      submitBtn.textContent = t.save
    } else {
      closeModal()
      fetchProducts()
    }
  })
}
