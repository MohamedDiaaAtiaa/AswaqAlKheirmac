import { supabase } from '../lib/supabase.js'
import { translations } from '../lib/translations.js'
import { Dialog } from '../lib/dialog.js'

let salesData = []
let branches = []
let isSouqView = false
let selectedBranchId = ''
let selectedDate = new Date().toISOString().split('T')[0]

export async function loadBranchSales(container, souqMode = false) {
  isSouqView = souqMode
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  // Header actions
  const headerActions = document.getElementById('header-actions')
  headerActions.innerHTML = ''

  if (isSouqView) {
    const { data: branchData } = await supabase.from('branches').select('id, name, name_en').eq('is_active', true)
    branches = branchData || []
  }

  const currentBranchId = localStorage.getItem('aswaq_branch_id') || ''
  selectedBranchId = isSouqView ? (branches[0]?.id || '') : currentBranchId

  container.innerHTML = `
    <div class="card" style="margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <label style="font-weight: 600;">${t.date || 'التاريخ'}:</label>
        <input type="date" id="bs-date-filter" value="${selectedDate}" class="branch-select" style="min-width: 150px;">
      </div>
      ${isSouqView ? `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <label style="font-weight: 600;">${t.bs_select_branch || 'الفرع'}:</label>
          <select id="bs-branch-filter" class="branch-select" style="min-width: 200px;">
            ${branches.map(b => `<option value="${b.id}">${lang === 'ar' ? b.name : (b.name_en || b.name)}</option>`).join('')}
          </select>
        </div>
      ` : ''}
    </div>
    <div class="card" style="margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
      <h3 style="margin: 0;">${t.bs_title || 'جدول السوق'}</h3>
      <button id="bs-add-row" class="btn-primary" style="padding: 0.4rem 1rem;">+ ${t.bs_add_row || 'إضافة صنف'}</button>
    </div>
    <div class="table-container">
      <table class="bs-table">
        <thead>
          <tr>
            <th>${t.bs_product || 'الصنف'}</th>
            <th>${t.bs_quantity || 'العدد'}</th>
            <th>${t.bs_weight || 'الوزن'}</th>
            <th>${t.bs_price || 'السعر'}</th>
            <th>${t.bs_bayaawa_meshal || 'بياعة ومشال'}</th>
            <th>${t.bs_total || 'الإجمالي'}</th>
            <th>${t.actions || 'الإجراءات'}</th>
          </tr>
        </thead>
        <tbody id="bs-tbody">
          <tr><td colspan="7" style="text-align: center;">${t.loading}</td></tr>
        </tbody>
        <tfoot id="bs-tfoot"></tfoot>
      </table>
    </div>
  `

  document.getElementById('bs-date-filter').addEventListener('change', (e) => {
    selectedDate = e.target.value
    fetchSalesData()
  })

  document.getElementById('bs-add-row')?.addEventListener('click', () => openAddRowModal())

  if (isSouqView) {
    document.getElementById('bs-branch-filter')?.addEventListener('change', (e) => {
      selectedBranchId = e.target.value
      fetchSalesData()
    })
  }

  await fetchSalesData()
}

async function fetchSalesData() {
  const tbody = document.getElementById('bs-tbody')
  if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">${translations[localStorage.getItem('aswaq_lang') || 'ar'].loading}</td></tr>`

  const { data, error } = await supabase
    .from('branch_sales')
    .select('*')
    .eq('branch_id', selectedBranchId)
    .eq('sale_date', selectedDate)
    .order('created_at', { ascending: true })

  if (data && data.length > 0) {
    salesData = data
    renderTable()
  } else {
    // If no data for today, try to get product list from most recent previous day
    const { data: prevData } = await supabase
      .from('branch_sales')
      .select('product_name, price')
      .eq('branch_id', selectedBranchId)
      .order('sale_date', { ascending: false })
      .limit(50)

    if (prevData && prevData.length > 0) {
      const uniqueProducts = Array.from(new Set(prevData.map(p => p.product_name))).map(name => {
        const p = prevData.find(item => item.product_name === name)
        return {
          branch_id: selectedBranchId,
          sale_date: selectedDate,
          product_name: name,
          price: p.price,
          quantity: 0,
          count: 0,
          meshal: 0
        }
      })
      salesData = uniqueProducts
      renderTable()
    } else {
      salesData = []
      renderTable()
    }
  }
}

function renderTable() {
  const tbody = document.getElementById('bs-tbody')
  const tfoot = document.getElementById('bs-tfoot')
  if (!tbody) return

  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  if (salesData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">${t.bs_no_data || 'لا توجد بيانات'}</td></tr>`
    tfoot.innerHTML = ''
    return
  }

  let grandBayaawaMeshal = 0
  let grandTotal = 0

  tbody.innerHTML = salesData.map((row, index) => {
    // New formula: total = (weight × price) + بياعة ومشال
    const weight = parseFloat(row.count) || 0       // 'count' column = weight
    const price = parseFloat(row.price) || 0
    const bayaawaMeshal = parseFloat(row.meshal) || 0  // 'meshal' column = بياعة ومشال per item
    const total = (weight * price) + bayaawaMeshal

    grandBayaawaMeshal += bayaawaMeshal
    grandTotal += total

    const canEditPrice = isSouqView
    const canEditBranch = !isSouqView

    return `
    <tr data-id="${row.id || ''}" data-index="${index}">
      <td style="font-weight: 600;">${row.product_name}</td>
      <td>
        <input type="number" class="bs-cell-input" data-field="quantity" value="${row.quantity || 0}" 
          ${canEditBranch ? '' : 'readonly'} min="0">
      </td>
      <td>
        <input type="number" step="0.01" class="bs-cell-input" data-field="count" value="${weight.toFixed(2)}" 
          ${canEditBranch ? '' : 'readonly'} min="0">
      </td>
      <td>
        <input type="number" step="0.01" class="bs-cell-input" data-field="price" value="${price.toFixed(2)}" 
          ${(canEditPrice || canEditBranch) ? '' : 'readonly'} min="0">
      </td>
      <td>
        <input type="number" step="0.01" class="bs-cell-input" data-field="meshal" value="${bayaawaMeshal.toFixed(2)}" 
          ${canEditBranch ? '' : 'readonly'} min="0">
      </td>
      <td style="font-weight: 700; color: var(--success, #22c55e);">${total.toFixed(2)}</td>
      <td>
        <button class="btn-icon bs-delete-btn" data-id="${row.id || ''}" data-index="${index}" style="color: var(--error);">✕</button>
      </td>
    </tr>
  `}).join('')

  tfoot.innerHTML = `
    <tr style="font-weight: 700; background: var(--surface-hover);">
      <td colspan="4" style="text-align: ${lang === 'ar' ? 'right' : 'left'};">${t.total || 'الإجمالي'}</td>
      <td style="color: var(--primary);">${grandBayaawaMeshal.toFixed(2)}<div style="font-size:0.7rem;font-weight:400;color:var(--text-muted);">${t.bs_daily_meshal || 'المشال'}</div></td>
      <td style="color: var(--success, #22c55e);">${grandTotal.toFixed(2)}</td>
      <td></td>
    </tr>
  `

  tbody.querySelectorAll('.bs-cell-input').forEach(input => {
    input.addEventListener('change', async () => {
      const tr = input.closest('tr')
      const index = tr.dataset.index
      const id = tr.dataset.id
      const field = input.dataset.field
      const value = parseFloat(input.value) || 0

      const row = salesData[index]
      row[field] = value

      if (id) {
        const { error } = await supabase.from('branch_sales').update({ [field]: value }).eq('id', id)
        if (error) Dialog.alert('Error: ' + error.message)
      } else {
        // Upsert logic for new daily entries carried over
        const { data: upserted, error } = await supabase
          .from('branch_sales')
          .upsert([{
            branch_id: selectedBranchId,
            sale_date: selectedDate,
            product_name: row.product_name,
            quantity: row.quantity,
            count: row.count,
            price: row.price,
            meshal: row.meshal
          }], { onConflict: 'branch_id, sale_date, product_name' })
          .select()

        if (error) {
          Dialog.alert('Error: ' + error.message)
        } else if (upserted && upserted[0]) {
          row.id = upserted[0].id
          tr.dataset.id = row.id
        }
      }
      renderTable()
    })
  })

  tbody.querySelectorAll('.bs-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!await Dialog.confirm(t.confirm_delete || 'هل أنت متأكد؟')) return
      const id = btn.dataset.id
      const index = btn.dataset.index
      if (id) {
        const { error } = await supabase.from('branch_sales').delete().eq('id', id)
        if (error) return Dialog.alert('Error: ' + error.message)
      }
      salesData.splice(index, 1)
      renderTable()
    })
  })
}

async function openAddRowModal() {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  const modalHtml = `
    <div class="modal-overlay" id="bs-add-overlay">
      <div class="modal" style="max-width: 420px;">
        <div class="modal-header">
          <h3>${t.bs_add_row || 'إضافة صنف'}</h3>
          <button id="bs-close-modal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="input-group">
            <label>${t.bs_product || 'الصنف'}</label>
            <input type="text" id="bs-new-product" required placeholder="${t.product_name_placeholder || 'اسم المنتج...'}">
          </div>
          <div class="input-group">
            <label>${t.bs_price || 'السعر'}</label>
            <input type="number" step="0.01" id="bs-new-price" value="0" min="0">
          </div>
        </div>
        <div class="modal-footer">
          <button id="bs-cancel-modal" class="btn-secondary">${t.cancel}</button>
          <button id="bs-confirm-add" class="btn-primary">${t.save}</button>
        </div>
      </div>
    </div>
  `

  document.body.insertAdjacentHTML('beforeend', modalHtml)
  const overlay = document.getElementById('bs-add-overlay')

  document.getElementById('bs-close-modal').addEventListener('click', () => overlay.remove())
  document.getElementById('bs-cancel-modal').addEventListener('click', () => overlay.remove())

  document.getElementById('bs-confirm-add').addEventListener('click', async () => {
    const productName = document.getElementById('bs-new-product').value.trim()
    if (!productName) return Dialog.alert(t.enter_product_name || 'يرجى إدخال اسم المنتج.')
    const price = parseFloat(document.getElementById('bs-new-price').value) || 0

    const { error } = await supabase.from('branch_sales').insert([{
      branch_id: selectedBranchId,
      sale_date: selectedDate,
      product_name: productName,
      price: price
    }])

    if (error) {
      Dialog.alert('Error: ' + error.message)
    } else {
      overlay.remove()
      await fetchSalesData()
    }
  })
}
