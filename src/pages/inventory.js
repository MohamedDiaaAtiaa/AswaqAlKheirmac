import { supabase } from '../lib/supabase.js'
import { translations } from '../lib/translations.js'
import { Dialog } from '../lib/dialog.js'
let products = []
let categories = []
let activeModal = null
let isSouqMode = false
const WEIGHT_UNITS = ['kg', 'g', 'lb', 'l', 'ml']

function parseLocalizedNumber(value, fallback = 0) {
  const normalized = String(value ?? '')
    .replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632)
    .replace(/[۰-۹]/g, d => d.charCodeAt(0) - 1776)
    .replace(',', '.')
    .trim()
  const parsed = parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : fallback
}

function roundQuantity(value) {
  return Math.round((parseLocalizedNumber(value, 0) + Number.EPSILON) * 1000) / 1000
}

function productAllowsDecimals(product) {
  const unit = String(product?.unit || '').toLowerCase()
  return Boolean(product?.accepts_decimals) || WEIGHT_UNITS.includes(unit)
}

function getMaxDecimalDivisible(product) {
  const fallback = WEIGHT_UNITS.includes(String(product?.unit || '').toLowerCase()) ? 4 : 1
  return Math.max(1, roundQuantity(product?.max_decimal_divisible || fallback))
}

function getStockStep(product) {
  return productAllowsDecimals(product) ? 1 / getMaxDecimalDivisible(product) : 1
}

function normalizeProduct(product) {
  return {
    ...product,
    sizes: Array.isArray(product?.sizes) && product.sizes.length > 0
      ? product.sizes
      : [{ label: 'Default', price: 0, old_price: null }],
    accepts_decimals: productAllowsDecimals(product),
    max_decimal_divisible: getMaxDecimalDivisible(product),
    stock: roundQuantity(product?.stock || 0)
  }
}

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
    ...(active || []).map(p => normalizeProduct({ ...p, _table: 'products' })),
    ...(outOfStock || []).map(p => normalizeProduct({ ...p, _table: 'out_of_stock_products' }))
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
    const sizes = Array.isArray(p.sizes) ? p.sizes : []
    const minPrice = sizes.length > 0 ? Math.min(...sizes.map(s => parseLocalizedNumber(s.price, 0))) : 0
    const discountedVariant = p.sizes.find(s => s.old_price > s.price)
    const discountPercent = discountedVariant ? Math.round((1 - discountedVariant.price / discountedVariant.old_price) * 100) : 0

    const catObj = categories.find(c => c.id === p.category)
    const catLabel = getCategoryLabel(catObj)
    const catDisplay = catObj ? `${catObj.emoji} ${catLabel}` : p.category

    const displayName = getProductName(p)

    const isWeight = WEIGHT_UNITS.includes(String(p.unit || '').toLowerCase())
    const stockStep = getStockStep(p)

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
      <td style="font-size: 0.75rem; color: var(--text-muted);">${isWeight ? `⚖️ ${t['unit_' + p.unit] || p.unit}` : `${p.sizes.length} ${t.variants_count}`}</td>
      <td>
        <div style="font-weight: 700;">EGP ${minPrice.toFixed(2)}${isWeight ? `/${t['unit_' + p.unit] || p.unit}` : ''}</div>
        ${discountedVariant ? `<div class="old-price">EGP ${discountedVariant.old_price.toFixed(2)}</div>` : ''}
      </td>
      <td>
        <div class="stock-manager">
          <button class="stock-btn minus" data-id="${p.id}" data-table="${p._table}">-</button>
          <input type="text" inputmode="decimal" class="stock-input" value="${p.stock || 0}" data-step="${stockStep}" data-id="${p.id}" data-table="${p._table}">
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
      const step = getStockStep(product)
      const newStock = Math.max(0, roundQuantity((product.stock || 0) + (delta * step)))
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
      const newStock = Math.max(0, roundQuantity(parseLocalizedNumber(input.value, 0)))
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
  const { data: souqProductsData, error } = await supabase
    .from('products')
    .select('*')
    .is('branch_id', null)

  if (error) return Dialog.alert('Error fetching Souq: ' + error.message)
  const souqProducts = (souqProductsData || []).map(normalizeProduct)

  const modalHtml = `
    <div class="modal-overlay" id="souq-picker-overlay">
      <div class="modal" style="max-width: 900px; width: 95%; max-height: 90vh; display: flex; flex-direction: column;">
        <div class="modal-header">
          <h3>${t.select_from_souq}</h3>
          <button id="close-souq-picker" class="close-btn">&times;</button>
        </div>
        <div class="modal-body" style="overflow-y: auto; padding: 1rem; flex: 1;">
          <div class="souq-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem;">
            ${souqProducts.map(sp => {
              const branchProduct = products.find(p => p.parent_product_id === sp.id)
              const isAdded = !!branchProduct
              const displayName = getProductName(sp)
              const minPrice = sp.sizes?.length > 0 ? Math.min(...sp.sizes.map(s => parseLocalizedNumber(s.price, 0))) : 0
              const isWeight = WEIGHT_UNITS.includes(String(sp.unit || '').toLowerCase())
              const stockStep = getStockStep(sp)
              
              if (isAdded) {
                // Shaded out with branch stock controls
                return `
                  <div class="souq-card added" style="border: 1px solid var(--border); border-radius: 12px; padding: 1rem; opacity: 0.65; background: var(--surface-hover); position: relative;">
                    <div style="position: absolute; top: 0.5rem; right: 0.5rem; background: var(--primary); color: white; font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 4px;">Added</div>
                    <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 0.75rem;">
                      ${sp.image_url ? `<img src="${sp.image_url}" style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover;">` : `<span style="font-size: 2rem;">${sp.emoji || '🛒'}</span>`}
                      <div>
                        <div style="font-weight: 600; font-size: 0.9rem;">${displayName}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">${minPrice.toFixed(2)} ${t.currency || 'EGP'}</div>
                      </div>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem;">Souq Leftover: ${sp.stock} ${sp.unit ? t['unit_' + sp.unit] || sp.unit : ''}</div>
                    <div class="stock-manager" style="justify-content: center; background: var(--surface); padding: 0.25rem; border-radius: 8px;">
                      <button class="stock-btn minus" data-id="${branchProduct.id}" data-table="${branchProduct._table}">-</button>
                      <input type="text" inputmode="decimal" class="stock-input" value="${branchProduct.stock || 0}" data-step="${stockStep}" data-id="${branchProduct.id}" data-table="${branchProduct._table}" style="width: 50px; text-align: center;">
                      <button class="stock-btn plus" data-id="${branchProduct.id}" data-table="${branchProduct._table}">+</button>
                    </div>
                  </div>
                `
              } else {
                // Not added, allow pulling from Souq
                return `
                  <div class="souq-card" style="border: 1px solid var(--border); border-radius: 12px; padding: 1rem; background: var(--surface);">
                    <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 0.75rem;">
                      ${sp.image_url ? `<img src="${sp.image_url}" style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover;">` : `<span style="font-size: 2rem;">${sp.emoji || '🛒'}</span>`}
                      <div>
                        <div style="font-weight: 600; font-size: 0.9rem;">${displayName}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">${minPrice.toFixed(2)} ${t.currency || 'EGP'}</div>
                      </div>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem;">Souq Leftover: ${sp.stock} ${sp.unit ? t['unit_' + sp.unit] || sp.unit : ''}</div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                      <input type="text" inputmode="decimal" id="souq-qty-${sp.id}" placeholder="${stockStep}" value="${stockStep}" style="width: 70px; padding: 0.4rem; border: 1px solid var(--border); border-radius: 6px; text-align: center;">
                      <button class="btn-primary add-souq-btn" data-id="${sp.id}" style="flex: 1; padding: 0.4rem;">${t.add || 'Add'}</button>
                    </div>
                  </div>
                `
              }
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `

  document.body.insertAdjacentHTML('beforeend', modalHtml)
  const overlay = document.getElementById('souq-picker-overlay')

  document.getElementById('close-souq-picker').addEventListener('click', () => {
    overlay.remove()
    fetchProducts()
  })

  // Handle stock updates for already added products
  overlay.querySelectorAll('.stock-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id
      const table = btn.dataset.table
      const delta = btn.classList.contains('plus') ? 1 : -1
      const branchProduct = products.find(p => p.id === id)
      const step = getStockStep(branchProduct)
      const newStock = Math.max(0, roundQuantity((branchProduct.stock || 0) + (delta * step)))
      
      const input = btn.parentElement.querySelector('.stock-input')
      input.value = newStock
      
      await updateStock(id, table, newStock)
    })
  })

  overlay.querySelectorAll('.stock-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        input.blur()
      }
    })
    input.addEventListener('change', async () => {
      const id = input.dataset.id
      const table = input.dataset.table
      const newStock = Math.max(0, roundQuantity(parseLocalizedNumber(input.value, 0)))
      await updateStock(id, table, newStock)
    })
  })

  // Handle adding new products from Souq
  overlay.querySelectorAll('.add-souq-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const productId = btn.dataset.id
      const qtyInput = document.getElementById(`souq-qty-${productId}`)
      const qty = Math.max(0, roundQuantity(qtyInput.value))
      const souqProduct = souqProducts.find(p => p.id === productId)

      if (!souqProduct) return Dialog.alert('Product not found')
      if (qty <= 0) return Dialog.alert('Please enter a valid quantity')
      if (qty > souqProduct.stock) return Dialog.alert('Not enough stock in Souq!')

      btn.disabled = true
      btn.textContent = t.saving || 'Saving...'

      // 1. Subtract from Souq
      const { error: subErr } = await supabase
        .from('products')
        .update({ stock: Math.max(0, roundQuantity(souqProduct.stock - qty)) })
        .eq('id', productId)

      if (subErr) {
        Dialog.alert('Error: ' + subErr.message)
        btn.disabled = false
        btn.textContent = t.add || 'Add'
        return
      }

      if (roundQuantity(souqProduct.stock - qty) <= 0) {
        await Dialog.alert(t.souq_stock_alert || 'Alert: Product is out of stock in Main Souq!')
      }

      // 2. Add to Branch
      const newProduct = { ...souqProduct }
      delete newProduct.id
      delete newProduct.created_at
      delete newProduct.updated_at
      newProduct.branch_id = currentBranchId
      newProduct.parent_product_id = productId
      newProduct.stock = qty
      
      await supabase.from('products').insert([newProduct])
      
      overlay.remove()
      await fetchProducts()
      openSouqPickerModal()
    })
  })

  // Support pressing Enter in the quantity input
  overlay.querySelectorAll('input[id^="souq-qty-"]').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        const productId = input.id.replace('souq-qty-', '')
        const btn = overlay.querySelector(`.add-souq-btn[data-id="${productId}"]`)
        if (btn) btn.click()
      }
    })
  })
}

function openEditModal(product = null) {
  const isEdit = !!product
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  // Determine initial sell type from existing product
  let sellType = (product?.unit && WEIGHT_UNITS.includes(String(product.unit).toLowerCase())) ? 'weight' : 'unit'
  let weightPrice = sellType === 'weight' && product?.sizes?.length > 0 ? product.sizes[0].price : ''
  let weightOldPrice = sellType === 'weight' && product?.sizes?.length > 0 ? (product.sizes[0].old_price || '') : ''
  let weightUnit = sellType === 'weight' ? product.unit : 'kg'
  let variants = product?.sizes?.length ? [...product.sizes] : [{ label: 'Default', price: 0, old_price: null }]
  const initialAcceptsDecimals = product ? productAllowsDecimals(product) : sellType === 'weight'
  const initialMaxDecimalDivisible = product ? getMaxDecimalDivisible(product) : (sellType === 'weight' ? 4 : 1)

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
                <label>${t.description_ar}</label>
                <textarea name="description_ar" rows="2" placeholder="${t.description_ar}">${product?.description_ar || ''}</textarea>
              </div>
              <div class="input-group">
                <label>${t.description_en}</label>
                <textarea name="description_en" rows="2" placeholder="${t.description_en}">${product?.description_en || ''}</textarea>
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
                <label>${t.stock}</label>
                <input type="number" name="stock" required value="${product?.stock || 0}">
              </div>
            </div>
            <div class="form-grid">
              <div class="input-group">
                <label>${t.emoji}</label>
                <input type="text" name="emoji" value="${product?.emoji || '🛒'}">
              </div>
              <div class="input-group">
                <label>${t.accepts_decimals || 'Accepts Decimals'}</label>
                <select name="accepts_decimals" id="accepts-decimals-select">
                  <option value="false" ${!initialAcceptsDecimals ? 'selected' : ''}>${t.no || 'No'}</option>
                  <option value="true" ${initialAcceptsDecimals ? 'selected' : ''}>${t.yes || 'Yes'}</option>
                </select>
              </div>
            </div>
            <div class="form-grid" id="max-decimal-container" style="display: ${initialAcceptsDecimals ? 'grid' : 'none'};">
              <div class="input-group">
                <label>${t.max_decimal_divisible || 'Max Decimal Divisible (e.g. 1, 2, 4)'}</label>
                <input type="number" name="max_decimal_divisible" min="1" value="${initialMaxDecimalDivisible}">
              </div>
            </div>
            <div class="form-grid">
              <div class="input-group" style="grid-column: span 2;">
                <label>${t.product_image}</label>
                <div style="display: flex; align-items: center; gap: 1rem;">
                  <div id="product-image-preview" style="width: 60px; height: 60px; border-radius: 8px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; overflow: hidden; background: var(--surface-hover);">
                    ${product?.image_url ? `<img src="${product.image_url}" style="width: 100%; height: 100%; object-fit: cover;">` : '<span style="color: var(--text-muted); font-size: 24px;">📷</span>'}
                  </div>
                  <div style="flex: 1;">
                    <input type="file" id="product-image-upload" accept="image/*" style="display: none;">
                    <button type="button" class="btn-secondary" onclick="document.getElementById('product-image-upload').click()">${t.upload_logo || 'Upload Image'}</button>
                    <input type="hidden" name="image_url" id="product-image-url" value="${product?.image_url || ''}">
                  </div>
                </div>
              </div>
            </div>
            <hr>
            <!-- Sell Type Toggle -->
            <div class="input-group" style="margin-bottom: 1rem;">
              <label>${t.sell_type}</label>
              <div id="sell-type-toggle" style="display: flex; gap: 0; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border); max-width: 320px;">
                <button type="button" data-sell-type="unit" class="sell-type-btn ${sellType === 'unit' ? 'active' : ''}" style="flex: 1; padding: 0.6rem 1rem; border: none; cursor: pointer; font-weight: 600; font-size: 0.85rem; transition: all 0.2s ease; ${sellType === 'unit' ? 'background: var(--primary); color: white;' : 'background: var(--surface-hover); color: var(--text-secondary);'}">
                  📦 ${t.sell_by_unit}
                </button>
                <button type="button" data-sell-type="weight" class="sell-type-btn ${sellType === 'weight' ? 'active' : ''}" style="flex: 1; padding: 0.6rem 1rem; border: none; border-left: 1px solid var(--border); cursor: pointer; font-weight: 600; font-size: 0.85rem; transition: all 0.2s ease; ${sellType === 'weight' ? 'background: var(--primary); color: white;' : 'background: var(--surface-hover); color: var(--text-secondary);'}">
                  ⚖️ ${t.sell_by_weight}
                </button>
              </div>
            </div>
            <!-- Unit Section: sizes/variants -->
            <div id="unit-section" style="display: ${sellType === 'unit' ? 'block' : 'none'};">
              <div id="full-variants-container"></div>
              <button type="button" id="add-variant-btn" class="btn-secondary" style="margin-top:0.5rem;">+ ${t.add_variant}</button>
            </div>
            <!-- Weight Section: price per weight unit + unit picker -->
            <div id="weight-section" style="display: ${sellType === 'weight' ? 'block' : 'none'};">
              <div class="form-grid">
                <div class="input-group">
                  <label>${t.price_per_weight}</label>
                  <input type="number" step="0.01" id="weight-price-input" value="${weightPrice}" min="0" placeholder="0.00">
                </div>
                <div class="input-group">
                  <label>${t.was}</label>
                  <input type="number" step="0.01" id="weight-old-price-input" value="${weightOldPrice}" min="0" placeholder="0.00">
                </div>
                <div class="input-group">
                  <label>${t.weight_unit}</label>
                  <select id="weight-unit-select">
                    <option value="kg" ${weightUnit === 'kg' ? 'selected' : ''}>${t.unit_kg}</option>
                    <option value="g" ${weightUnit === 'g' ? 'selected' : ''}>${t.unit_g}</option>
                    <option value="lb" ${weightUnit === 'lb' ? 'selected' : ''}>${t.unit_lb}</option>
                  </select>
                </div>
              </div>
            </div>
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

  // Decimal logic
  const acceptsDecimalsSelect = document.getElementById('accepts-decimals-select')
  const maxDecimalContainer = document.getElementById('max-decimal-container')
  const maxDecimalInput = document.querySelector('input[name="max_decimal_divisible"]')
  const syncDecimalControls = () => {
    const weightMode = sellType === 'weight'
    if (weightMode) {
      acceptsDecimalsSelect.value = 'true'
      acceptsDecimalsSelect.disabled = true
      if (parseLocalizedNumber(maxDecimalInput.value, 0) <= 1) {
        maxDecimalInput.value = '4'
      }
      maxDecimalContainer.style.display = 'grid'
      return
    }

    acceptsDecimalsSelect.disabled = false
    maxDecimalContainer.style.display = acceptsDecimalsSelect.value === 'true' ? 'grid' : 'none'
    if (acceptsDecimalsSelect.value !== 'true') {
      maxDecimalInput.value = '1'
    }
  }
  acceptsDecimalsSelect.addEventListener('change', syncDecimalControls)

  // Sell type toggle logic
  const unitSection = document.getElementById('unit-section')
  const weightSection = document.getElementById('weight-section')
  document.getElementById('sell-type-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sell-type]')
    if (!btn) return
    sellType = btn.dataset.sellType
    // Update toggle styles
    document.querySelectorAll('#sell-type-toggle .sell-type-btn').forEach(b => {
      if (b.dataset.sellType === sellType) {
        b.style.background = 'var(--primary)'
        b.style.color = 'white'
      } else {
        b.style.background = 'var(--surface-hover)'
        b.style.color = 'var(--text-secondary)'
      }
    })
    unitSection.style.display = sellType === 'unit' ? 'block' : 'none'
    weightSection.style.display = sellType === 'weight' ? 'block' : 'none'
    syncDecimalControls()
  })

  const renderVariants = () => {
    variantsContainer.innerHTML = variants.map((v, i) => `
      <div class="variant-item" style="display:flex; gap:0.5rem; margin-bottom:0.5rem;">
        <input type="text" placeholder="Label" value="${v.label}" onchange="updateFullVariant(${i}, 'label', this.value)" style="flex:2;">
        <input type="number" step="0.01" placeholder="Price" value="${v.price}" onchange="updateFullVariant(${i}, 'price', this.value)" style="flex:1;">
        <input type="number" step="0.01" placeholder="${t.was}" value="${v.old_price || ''}" onchange="updateFullVariant(${i}, 'old_price', this.value)" style="flex:1;">
        <button type="button" class="btn-icon" onclick="removeFullVariant(${i})" style="color:var(--error);">&times;</button>
      </div>
    `).join('')
  }

  window.updateFullVariant = (idx, field, val) => {
    if (field === 'price' || field === 'old_price') {
      if (!val && field === 'old_price') {
        variants[idx][field] = null;
      } else {
        let numVal = String(val).replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 1776);
        variants[idx][field] = parseFloat(numVal) || (field === 'price' ? 0 : null);
      }
    } else {
      variants[idx][field] = val;
    }
  }
  window.removeFullVariant = (idx) => {
    variants.splice(idx, 1)
    renderVariants()
  }

  renderVariants()
  syncDecimalControls()

  document.getElementById('add-variant-btn').addEventListener('click', () => {
    variants.push({ label: '', price: 0, old_price: null })
    renderVariants()
  })

  document.getElementById('product-image-upload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    const preview = document.getElementById('product-image-preview')
    preview.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-muted);">' + t.loading + '</span>'
    
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `public/${fileName}`
    
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file)
      
    if (uploadError) {
      Dialog.alert('Image upload failed: ' + uploadError.message)
      preview.innerHTML = '<span style="color: var(--text-muted); font-size: 24px;">📷</span>'
      return
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath)
      
    document.getElementById('product-image-url').value = publicUrl
    preview.innerHTML = `<img src="${publicUrl}" style="width: 100%; height: 100%; object-fit: cover;">`
  })

  document.getElementById('close-full-modal').addEventListener('click', () => overlay.remove())
  document.getElementById('cancel-full-modal').addEventListener('click', () => overlay.remove())

  document.getElementById('product-full-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)

    let finalUnit, finalSizes
    if (sellType === 'weight') {
      finalUnit = document.getElementById('weight-unit-select').value
      let wp = String(document.getElementById('weight-price-input').value)
        .replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632)
        .replace(/[۰-۹]/g, d => d.charCodeAt(0) - 1776)
      let wop = String(document.getElementById('weight-old-price-input').value || '')
        .replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632)
        .replace(/[۰-۹]/g, d => d.charCodeAt(0) - 1776)
      finalSizes = [{ label: t['unit_' + finalUnit] || finalUnit, price: parseLocalizedNumber(wp, 0), old_price: wop ? parseLocalizedNumber(wop, null) : null }]
    } else {
      finalUnit = 'item'
      finalSizes = variants
    }

    const acceptsDecimals = sellType === 'weight' || formData.get('accepts_decimals') === 'true'
    const maxDecimalDivisible = acceptsDecimals
      ? Math.max(1, roundQuantity(formData.get('max_decimal_divisible') || (sellType === 'weight' ? 4 : 1)))
      : 1

    const payload = {
      name: formData.get('name_ar'),
      name_ar: formData.get('name_ar'),
      name_en: formData.get('name_en'),
      description_ar: formData.get('description_ar'),
      description_en: formData.get('description_en'),
      category: formData.get('category'),
      unit: finalUnit,
      stock: Math.max(0, roundQuantity(formData.get('stock'))),
      emoji: formData.get('emoji'),
      image_url: formData.get('image_url') || null,
      sizes: finalSizes,
      accepts_decimals: acceptsDecimals,
      max_decimal_divisible: maxDecimalDivisible,
      branch_id: null // Explicitly null for Souq
    }

    const { error } = isEdit
      ? await supabase.from(product._table || 'products').update(payload).eq('id', product.id)
      : await supabase.from('products').insert([payload])

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
    if (pIndex > -1) products[pIndex].stock = roundQuantity(newStock)
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

            <div class="input-group" style="margin-top: 1rem;">
              <label>${t.active || 'Active'}</label>
              <select name="is_active" style="max-width: 200px;">
                <option value="true" ${product.is_active !== false ? 'selected' : ''}>${t.yes || 'Yes'}</option>
                <option value="false" ${product.is_active === false ? 'selected' : ''}>${t.no || 'No'}</option>
              </select>
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
      stock: Math.max(0, roundQuantity(formData.get('stock'))),
      sizes: variants,
      is_active: formData.get('is_active') === 'true'
    }

    const { error } = await supabase
      .from(product._table || 'products')
      .update(payload)
      .eq('id', product.id)

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
