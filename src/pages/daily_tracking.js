import { supabase } from '../lib/supabase.js'
import { translations } from '../lib/translations.js'
import { Dialog } from '../lib/dialog.js'

let branches = []
let products = []
let trackingData = []
let selectedBranchId = null
let selectedDate = new Date().toISOString().split('T')[0] // Today

export async function loadDailyTracking(container) {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  const headerActions = document.getElementById('header-actions')
  headerActions.innerHTML = `
    <button id="add-tracking-btn" class="btn-primary">
      <span>+</span> ${t.add_tracking_entry}
    </button>
  `

  container.innerHTML = `
    <!-- Filters Bar -->
    <div class="card" style="margin-bottom: 1.5rem; padding: 1rem;">
      <div style="display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap;">
        <div class="input-group" style="margin: 0; min-width: 200px;">
          <label style="font-size: 0.7rem;">${t.branch}</label>
          <select id="tracking-branch-filter" class="form-textarea" style="min-height: 44px; padding: 0.5rem 1rem;">
            <option value="">${t.loading}</option>
          </select>
        </div>
        <div class="input-group" style="margin: 0; min-width: 180px;">
          <label style="font-size: 0.7rem;">${t.date}</label>
          <input type="date" id="tracking-date-filter" value="${selectedDate}" style="min-height: 44px;">
        </div>
        <button id="tracking-today-btn" class="btn-secondary" style="min-height: 44px; padding: 0.5rem 1rem; font-size: 0.8rem;">
          📅 ${t.today}
        </button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="tracking-summary-grid" id="tracking-summary">
      <div class="tracking-stat-card">
        <div class="tracking-stat-icon">📦</div>
        <div class="tracking-stat-value" id="total-products-count">0</div>
        <div class="tracking-stat-label">${t.tracked_products}</div>
      </div>
      <div class="tracking-stat-card tracking-stat-sold">
        <div class="tracking-stat-icon">💰</div>
        <div class="tracking-stat-value" id="total-sold">0</div>
        <div class="tracking-stat-label">${t.total_sold} (${t.sold_label})</div>
      </div>
      <div class="tracking-stat-card tracking-stat-removed">
        <div class="tracking-stat-icon">🗑️</div>
        <div class="tracking-stat-value" id="total-removed">0</div>
        <div class="tracking-stat-label">${t.total_removed} (${t.removed_label})</div>
      </div>
      <div class="tracking-stat-card tracking-stat-total">
        <div class="tracking-stat-icon">📊</div>
        <div class="tracking-stat-value" id="total-movement">0</div>
        <div class="tracking-stat-label">${t.total_movement}</div>
      </div>
    </div>

    <!-- Tracking Table -->
    <div class="table-container" style="margin-top: 1.5rem;">
      <table>
        <thead>
          <tr>
            <th>${t.product}</th>
            <th>💰 ${t.sold_label} (${t.sold_qty})</th>
            <th>🗑️ ${t.removed_label} (${t.removed_qty})</th>
            <th>${t.total_movement}</th>
            <th>${t.notes}</th>
            <th>${t.actions}</th>
          </tr>
        </thead>
        <tbody id="tracking-tbody">
          <tr><td colspan="6" style="text-align: center;">${t.loading}</td></tr>
        </tbody>
      </table>
    </div>
  `

  document.getElementById('add-tracking-btn').addEventListener('click', () => openTrackingModal())

  await fetchBranchesForFilter()
  await fetchProductsList()

  document.getElementById('tracking-branch-filter').addEventListener('change', (e) => {
    selectedBranchId = e.target.value || null
    fetchTrackingData()
  })

  document.getElementById('tracking-date-filter').addEventListener('change', (e) => {
    selectedDate = e.target.value
    fetchTrackingData()
  })

  document.getElementById('tracking-today-btn').addEventListener('click', () => {
    selectedDate = new Date().toISOString().split('T')[0]
    document.getElementById('tracking-date-filter').value = selectedDate
    fetchTrackingData()
  })
}

async function fetchBranchesForFilter() {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('is_active', true)
    .order('is_default', { ascending: false })

  if (error) {
    console.error('Error fetching branches:', error)
    return
  }

  branches = data || []
  const select = document.getElementById('tracking-branch-filter')
  
  if (branches.length === 0) {
    select.innerHTML = `<option value="">${t.no_branches}</option>`
    return
  }

  // Auto-select default branch
  const defaultBranch = branches.find(b => b.is_default) || branches[0]
  selectedBranchId = defaultBranch.id

  select.innerHTML = branches.map(b => {
    const name = lang === 'ar' ? (b.name || b.name_en) : (b.name_en || b.name)
    return `<option value="${b.id}" ${b.id === selectedBranchId ? 'selected' : ''}>${name}</option>`
  }).join('')

  await fetchTrackingData()
}

async function fetchProductsList() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, name_ar, name_en, emoji')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching products:', error)
    return
  }

  products = data || []
}

async function fetchTrackingData() {
  if (!selectedBranchId) return

  const { data, error } = await supabase
    .from('daily_tracking')
    .select('*')
    .eq('branch_id', selectedBranchId)
    .eq('tracking_date', selectedDate)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching tracking data:', error)
    return
  }

  trackingData = data || []
  renderTrackingTable()
  updateSummaryCards()
}

function updateSummaryCards() {
  const totalSold = trackingData.reduce((s, d) => s + (parseFloat(d.sold_qty) || 0), 0)
  const totalRemoved = trackingData.reduce((s, d) => s + (parseFloat(d.removed_qty) || 0), 0)

  const soldEl = document.getElementById('total-sold')
  const removedEl = document.getElementById('total-removed')
  const movementEl = document.getElementById('total-movement')
  const productsEl = document.getElementById('total-products-count')

  if (soldEl) soldEl.textContent = totalSold.toFixed(1)
  if (removedEl) removedEl.textContent = totalRemoved.toFixed(1)
  if (movementEl) movementEl.textContent = (totalSold + totalRemoved).toFixed(1)
  if (productsEl) productsEl.textContent = trackingData.length
}

function renderTrackingTable() {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]
  const tbody = document.getElementById('tracking-tbody')
  if (!tbody) return

  if (trackingData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">${t.no_tracking_data}</td></tr>`
    return
  }

  tbody.innerHTML = trackingData.map(d => {
    const total = (parseFloat(d.sold_qty) || 0) + (parseFloat(d.removed_qty) || 0)
    return `
      <tr>
        <td>
          <div style="font-weight: 700;">${d.product_name}</div>
        </td>
        <td>
          <div class="inline-edit-group">
            <input type="number" class="inline-input sold-input" data-id="${d.id}" value="${d.sold_qty || 0}" step="0.1" min="0">
          </div>
        </td>
        <td>
          <div class="inline-edit-group">
            <input type="number" class="inline-input removed-input" data-id="${d.id}" value="${d.removed_qty || 0}" step="0.1" min="0">
          </div>
        </td>
        <td>
          <span style="font-weight: 700; font-size: 1rem;">${total.toFixed(1)}</span>
        </td>
        <td style="max-width: 200px;">
          <input type="text" class="inline-input notes-input" data-id="${d.id}" value="${d.notes || ''}" placeholder="${t.optional_notes}" style="width: 100%;">
        </td>
        <td>
          <div class="action-row" style="gap: 0.5rem;">
            <button class="btn-secondary save-tracking-btn" data-id="${d.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: var(--primary);">
              ${t.save}
            </button>
            <button class="btn-secondary delete-tracking-btn" data-id="${d.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: var(--error);">
              ${t.delete}
            </button>
            <button class="btn-secondary delete-all-branches-btn" data-name="${d.product_name}" data-date="${d.tracking_date}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: var(--error); border-color: var(--error);" title="${lang === 'ar' ? 'حذف من جميع الفروع لهذا اليوم' : 'Delete from all branches for this day'}">
              ${lang === 'ar' ? '🗑️ فروع اليوم' : '🗑️ Day Branches'}
            </button>
            <button class="btn-secondary delete-completely-btn" data-name="${d.product_name}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: white; background-color: var(--error); border-color: var(--error);" title="${lang === 'ar' ? 'إزالة المنتج نهائياً من التتبع' : 'Remove product completely from tracking'}">
              ${lang === 'ar' ? 'إزالة نهائية' : 'Remove Completely'}
            </button>
          </div>
        </td>
      </tr>
    `
  }).join('')

  // Attach inline save events
  tbody.querySelectorAll('.save-tracking-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id
      const row = btn.closest('tr')
      const soldQty = parseFloat(row.querySelector('.sold-input').value) || 0
      const removedQty = parseFloat(row.querySelector('.removed-input').value) || 0
      const notes = row.querySelector('.notes-input').value

      btn.textContent = '...'
      btn.disabled = true

      const { error } = await supabase
        .from('daily_tracking')
        .update({ sold_qty: soldQty, removed_qty: removedQty, notes })
        .eq('id', id)

      if (error) {
        await Dialog.alert('Error: ' + error.message)
      } else {
        // Update local data
        const entry = trackingData.find(d => d.id === id)
        if (entry) {
          entry.sold_qty = soldQty
          entry.removed_qty = removedQty
          entry.notes = notes
        }
        updateSummaryCards()
      }
      btn.textContent = t.save
      btn.disabled = false
    })
  })

  // Attach delete events (single branch)
  tbody.querySelectorAll('.delete-tracking-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (await Dialog.confirm(t.confirm_delete)) {
        const { error } = await supabase.from('daily_tracking').delete().eq('id', btn.dataset.id)
        if (!error) {
          await fetchTrackingData()
        }
      }
    })
  })

  // Attach delete-from-all-branches events
  tbody.querySelectorAll('.delete-all-branches-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const productName = btn.dataset.name
      const trackDate = btn.dataset.date
      const confirmMsg = lang === 'ar' 
        ? `هل أنت متأكد أنك تريد حذف "${productName}" من جميع الفروع؟`
        : `Are you sure you want to delete "${productName}" from ALL branches?`
      if (await Dialog.confirm(confirmMsg)) {
        const { error } = await supabase
          .from('daily_tracking')
          .delete()
          .eq('product_name', productName)
          .eq('tracking_date', trackDate)
        if (!error) {
          await fetchTrackingData()
        } else {
          await Dialog.alert('Error: ' + error.message)
        }
      }
    })
  })

  // Attach delete completely events
  tbody.querySelectorAll('.delete-completely-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const productName = btn.dataset.name
      const confirmMsg = lang === 'ar' 
        ? `تحذير: هل أنت متأكد أنك تريد إزالة "${productName}" نهائياً من التتبع في جميع الأيام وجميع الفروع؟ هذا الإجراء لا يمكن التراجع عنه.`
        : `WARNING: Are you sure you want to completely remove "${productName}" from tracking across ALL days and ALL branches? This cannot be undone.`
      if (await Dialog.confirm(confirmMsg)) {
        const { error } = await supabase
          .from('daily_tracking')
          .delete()
          .eq('product_name', productName)
        if (!error) {
          await fetchTrackingData()
        } else {
          await Dialog.alert('Error: ' + error.message)
        }
      }
    })
  })
}

function openTrackingModal() {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  const getProductName = (p) => {
    if (lang === 'ar') return p.name_ar || p.name || ''
    return p.name_en || p.name || ''
  }

  const productsOptions = products.map(p =>
    `<option value="${p.id}" data-name="${p.name}">${p.emoji || '📦'} ${getProductName(p)}</option>`
  ).join('')

  const branchOptions = branches.map(b => {
    const name = lang === 'ar' ? (b.name || b.name_en) : (b.name_en || b.name)
    return `<option value="${b.id}" ${b.id === selectedBranchId ? 'selected' : ''}>${name}</option>`
  }).join('')

  const modalHtml = `
    <div class="modal-overlay" id="tracking-modal-overlay">
      <div class="modal" style="max-width: 600px;">
        <div class="modal-header">
          <h3>${t.add_tracking_entry}</h3>
          <button id="close-tracking-modal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="tracking-form">
            <div class="form-grid">
              <div class="input-group">
                <label>${t.date}</label>
                <input type="date" name="tracking_date" required value="${selectedDate}">
              </div>
            </div>

            <div style="margin: 1rem 0; padding: 1rem; background: #f1f5f9; border-radius: 10px; border: 1px solid var(--border);">
              <label style="font-weight: 700; font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.75rem; display: block;">
                ${t.select_product_or_custom}
              </label>
              <div style="display: flex; gap: 0.75rem; margin-bottom: 0.75rem;">
                <label style="cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
                  <input type="radio" name="product_mode" value="select" checked> ${t.from_products}
                </label>
                <label style="cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
                  <input type="radio" name="product_mode" value="custom"> ${t.custom_product}
                </label>
              </div>
              <div id="product-select-group" class="input-group" style="margin: 0;">
                <select name="product_id" class="form-textarea" style="min-height: 48px; padding: 0.5rem 1rem;">
                  ${productsOptions}
                </select>
              </div>
              <div id="product-custom-group" class="input-group" style="margin: 0; display: none;">
                <input type="text" name="custom_product_name" placeholder="${t.product_name_placeholder}" dir="rtl">
              </div>
            </div>

            <div class="form-grid">
              <div class="input-group">
                <label>💰 ${t.sold_label} (${t.sold_qty})</label>
                <input type="number" name="sold_qty" step="0.1" min="0" value="0">
              </div>
              <div class="input-group">
                <label>🗑️ ${t.removed_label} (${t.removed_qty})</label>
                <input type="number" name="removed_qty" step="0.1" min="0" value="0">
              </div>
            </div>

            <div class="input-group">
              <label>${t.notes}</label>
              <input type="text" name="notes" placeholder="${t.optional_notes}">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button id="cancel-tracking-modal" class="btn-secondary">${t.cancel}</button>
          <button form="tracking-form" type="submit" class="btn-primary" style="width: auto;">${t.save}</button>
        </div>
      </div>
    </div>
  `

  document.body.insertAdjacentHTML('beforeend', modalHtml)
  const overlay = document.getElementById('tracking-modal-overlay')

  // Toggle product selection mode
  document.querySelectorAll('input[name="product_mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isCustom = radio.value === 'custom' && radio.checked
      document.getElementById('product-select-group').style.display = isCustom ? 'none' : 'block'
      document.getElementById('product-custom-group').style.display = isCustom ? 'block' : 'none'
    })
  })

  const close = () => overlay.remove()
  document.getElementById('close-tracking-modal').addEventListener('click', close)
  document.getElementById('cancel-tracking-modal').addEventListener('click', close)

  document.getElementById('tracking-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const submitBtn = e.target.closest('.modal').querySelector('.btn-primary')
    submitBtn.disabled = true
    submitBtn.textContent = t.saving

    const mode = formData.get('product_mode')
    let productId = null
    let productName = ''

    if (mode === 'select') {
      productId = formData.get('product_id')
      const prod = products.find(p => p.id === productId)
      productName = prod ? (lang === 'ar' ? (prod.name_ar || prod.name) : (prod.name_en || prod.name)) : 'Unknown'
    } else {
      productName = formData.get('custom_product_name')?.trim()
      if (!productName) {
        await Dialog.alert(t.enter_product_name)
        submitBtn.disabled = false
        submitBtn.textContent = t.save
        return
      }
    }

    const trackingDate = formData.get('tracking_date')
    const soldQty = parseFloat(formData.get('sold_qty')) || 0
    const removedQty = parseFloat(formData.get('removed_qty')) || 0
    const notes = formData.get('notes') || null

    // Add for ALL active branches
    const payloads = branches.map(branch => ({
      branch_id: branch.id,
      product_id: productId,
      product_name: productName,
      tracking_date: trackingDate,
      sold_qty: soldQty,
      removed_qty: removedQty,
      notes: notes
    }))

    const { error } = await supabase.from('daily_tracking').insert(payloads)

    if (error) {
      await Dialog.alert('Error: ' + error.message)
      submitBtn.disabled = false
      submitBtn.textContent = t.save
    } else {
      close()
      await fetchTrackingData()
    }
  })
}
