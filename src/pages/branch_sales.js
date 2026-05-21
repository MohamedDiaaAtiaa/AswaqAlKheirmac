import { supabase } from '../lib/supabase.js'
import { translations } from '../lib/translations.js'
import { Dialog } from '../lib/dialog.js'

let salesData = []
let branches = []
let categories = []
let isSouqView = false
let selectedBranchId = 'all' // default to all for souq
let selectedDate = new Date().toISOString().split('T')[0]

export async function loadBranchSales(container, souqMode = false) {
  isSouqView = souqMode
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  const headerActions = document.getElementById('header-actions')
  headerActions.innerHTML = ''

  // Fetch branches and categories
  const [branchesRes, categoriesRes] = await Promise.all([
    supabase.from('branches').select('id, name, name_en').eq('is_active', true),
    supabase.from('app_settings').select('value').eq('key', 'categories').single()
  ])

  branches = branchesRes.data || []
  categories = categoriesRes.data?.value || []

  const currentBranchId = localStorage.getItem('aswaq_branch_id') || ''
  if (!isSouqView) {
    selectedBranchId = currentBranchId
  }

  container.innerHTML = `
    <div class="card" style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; padding: 1.5rem;">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <label style="font-weight: 700; font-size: 1.1rem;">${t.date || 'التاريخ'}:</label>
        <input type="date" id="bs-date-filter" value="${selectedDate}" class="branch-select" style="min-width: 180px; font-size: 1.1rem; padding: 0.75rem;">
      </div>
      ${isSouqView ? `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <label style="font-weight: 700; font-size: 1.1rem;">${t.bs_select_branch || 'الفرع'}:</label>
          <select id="bs-branch-filter" class="branch-select" style="min-width: 250px; font-size: 1.1rem; padding: 0.75rem;">
            <option value="all">${lang === 'ar' ? 'جميع الفروع (تجميع)' : 'All Branches (Aggregated)'}</option>
            ${branches.map(b => `<option value="${b.id}" ${b.id === selectedBranchId ? 'selected' : ''}>${lang === 'ar' ? b.name : (b.name_en || b.name)}</option>`).join('')}
          </select>
        </div>
      ` : ''}
    </div>
    
    <div class="card" style="margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; padding: 1.5rem;">
      <h3 style="margin: 0; font-size: 1.5rem;">${t.bs_title || 'جدول السوق'}</h3>
      ${isSouqView ? `<div style="font-size: 1.1rem; font-weight: bold; color: var(--primary);">وضع مدير السوق</div>` : ''}
    </div>

    <div class="table-container">
      <table class="bs-table" style="font-size: 1.1rem;">
        <thead>
          <tr>
            <th style="font-size: 1.1rem; padding: 1rem;">الصورة</th>
            <th style="font-size: 1.1rem; padding: 1rem;">${t.bs_product || 'الصنف (الفئة)'}</th>
            <th style="font-size: 1.1rem; padding: 1rem;">${t.bs_quantity || 'العدد'}</th>
            <th style="font-size: 1.1rem; padding: 1rem;">${t.bs_weight || 'الوزن'}</th>
            <th style="font-size: 1.1rem; padding: 1rem;">${t.bs_price || 'السعر'}</th>
            <th style="font-size: 1.1rem; padding: 1rem;">${t.bs_bayaawa_meshal || 'بياعة ومشال'}</th>
            <th style="font-size: 1.1rem; padding: 1rem;">${t.bs_total || 'الإجمالي'}</th>
          </tr>
        </thead>
        <tbody id="bs-tbody">
          <tr><td colspan="7" style="text-align: center; padding: 2rem; font-size: 1.2rem;">${t.loading}</td></tr>
        </tbody>
        <tfoot id="bs-tfoot"></tfoot>
      </table>
    </div>
  `

  document.getElementById('bs-date-filter').addEventListener('change', (e) => {
    selectedDate = e.target.value
    fetchSalesData()
  })

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
  if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; font-size: 1.2rem;">${translations[localStorage.getItem('aswaq_lang') || 'ar'].loading}</td></tr>`

  const lang = localStorage.getItem('aswaq_lang') || 'ar'

  if (isSouqView && selectedBranchId === 'all') {
    // Aggregated view
    const { data, error } = await supabase
      .from('branch_sales')
      .select('*')
      .eq('sale_date', selectedDate)

    if (error) {
      console.error(error)
      salesData = []
      renderTable()
      return
    }

    // Aggregate by category name (product_name)
    const aggregated = {}
    
    // First setup all categories with 0
    categories.forEach(cat => {
      const catName = lang === 'ar' ? (cat.label_ar || cat.label_en || cat.id) : (cat.label_en || cat.label_ar || cat.id)
      aggregated[cat.id] = {
        is_aggregated: true,
        category_id: cat.id,
        product_name: catName,
        emoji: cat.emoji,
        image_url: cat.image_url,
        quantity: 0,
        count: 0,
        price: 0, // avg or just 0? maybe leave as 0 or avg later
        meshal: 0,
        total: 0
      }
    })

    if (data && data.length > 0) {
      data.forEach(row => {
        // Try to match by category_id if exists, else match by name
        let catId = row.category_id
        if (!catId) {
          const matchedCat = categories.find(c => c.label_ar === row.product_name || c.label_en === row.product_name || c.id === row.product_name)
          if (matchedCat) catId = matchedCat.id
        }
        
        if (catId && aggregated[catId]) {
          aggregated[catId].quantity += (row.quantity || 0)
          aggregated[catId].count += (parseFloat(row.count) || 0)
          // For aggregated, we just sum meshal and calculate total?
          aggregated[catId].meshal += (parseFloat(row.meshal) || 0)
          // Wait, if price differs per branch, aggregated total is complex. Let's just sum the individual totals.
          const w = parseFloat(row.count) || 0
          const p = parseFloat(row.price) || 0
          const m = parseFloat(row.meshal) || 0
          aggregated[catId].total += (w * p) + m
        }
      })
    }
    
    salesData = Object.values(aggregated)
    renderTable()

  } else {
    // Specific branch view
    const branchToFetch = isSouqView ? selectedBranchId : (localStorage.getItem('aswaq_branch_id') || '')
    
    const { data, error } = await supabase
      .from('branch_sales')
      .select('*')
      .eq('branch_id', branchToFetch)
      .eq('sale_date', selectedDate)

    const existingRows = data || []
    
    // Always show all categories for the branch
    salesData = categories.map(cat => {
      const catName = lang === 'ar' ? (cat.label_ar || cat.label_en || cat.id) : (cat.label_en || cat.label_ar || cat.id)
      
      // Find if this branch has an entry for this category today
      const existing = existingRows.find(r => r.category_id === cat.id || r.product_name === catName || r.product_name === cat.label_ar || r.product_name === cat.label_en)
      
      if (existing) {
        return {
          ...existing,
          display_name: catName,
          emoji: cat.emoji,
          image_url: cat.image_url,
          category_id: cat.id
        }
      } else {
        return {
          branch_id: branchToFetch,
          sale_date: selectedDate,
          product_name: catName,
          category_id: cat.id,
          display_name: catName,
          emoji: cat.emoji,
          image_url: cat.image_url,
          quantity: 0,
          count: 0,
          price: 0,
          meshal: 0
        }
      }
    })
    
    renderTable()
  }
}

function renderTable() {
  const tbody = document.getElementById('bs-tbody')
  const tfoot = document.getElementById('bs-tfoot')
  if (!tbody) return

  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  if (salesData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem; font-size: 1.2rem;">${t.bs_no_data || 'لا توجد بيانات'}</td></tr>`
    tfoot.innerHTML = ''
    return
  }

  let grandBayaawaMeshal = 0
  let grandTotal = 0

  tbody.innerHTML = salesData.map((row, index) => {
    const weight = parseFloat(row.count) || 0
    const price = parseFloat(row.price) || 0
    const bayaawaMeshal = parseFloat(row.meshal) || 0
    
    let total = 0
    if (row.is_aggregated) {
      total = row.total || 0
    } else {
      total = (weight * price) + bayaawaMeshal
    }

    grandBayaawaMeshal += bayaawaMeshal
    grandTotal += total

    const isAggregated = row.is_aggregated
    const canEditQuantity = !isAggregated && (!isSouqView || isSouqView) // branch can edit quantity, market can too
    const canEditDetails = !isAggregated && isSouqView // only market can edit weight, price, meshal

    const imageHtml = row.image_url 
      ? `<img src="${row.image_url}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;">`
      : `<span style="font-size: 1.8rem;">${row.emoji || '📦'}</span>`

    return `
    <tr data-id="${row.id || ''}" data-index="${index}" data-catid="${row.category_id || ''}">
      <td style="text-align: center; padding: 0.5rem;">${imageHtml}</td>
      <td style="font-weight: 700; font-size: 1.1rem;">${row.display_name || row.product_name}</td>
      <td>
        ${isAggregated ? 
          `<div style="font-size: 1.2rem; font-weight: bold; text-align: center;">${row.quantity}</div>` : 
          `<input type="number" class="bs-cell-input" data-field="quantity" value="${row.quantity || 0}" 
          ${canEditQuantity ? '' : 'readonly'} min="0" style="font-size: 1.1rem; padding: 0.5rem; max-width: 120px;">`
        }
      </td>
      <td>
        ${isAggregated ? 
          `<div style="font-size: 1.2rem; font-weight: bold; text-align: center;">${weight.toFixed(2)}</div>` : 
          `<input type="number" step="0.01" class="bs-cell-input" data-field="count" value="${weight.toFixed(2)}" 
          ${canEditDetails ? '' : 'readonly'} min="0" style="font-size: 1.1rem; padding: 0.5rem; max-width: 120px;">`
        }
      </td>
      <td>
        ${isAggregated ? 
          `<div style="font-size: 1.2rem; text-align: center; color: var(--text-muted);">-</div>` : 
          `<input type="number" step="0.01" class="bs-cell-input" data-field="price" value="${price.toFixed(2)}" 
          ${canEditDetails ? '' : 'readonly'} min="0" style="font-size: 1.1rem; padding: 0.5rem; max-width: 120px;">`
        }
      </td>
      <td>
        ${isAggregated ? 
          `<div style="font-size: 1.2rem; font-weight: bold; text-align: center;">${bayaawaMeshal.toFixed(2)}</div>` : 
          `<input type="number" step="0.01" class="bs-cell-input" data-field="meshal" value="${bayaawaMeshal.toFixed(2)}" 
          ${canEditDetails ? '' : 'readonly'} min="0" style="font-size: 1.1rem; padding: 0.5rem; max-width: 120px;">`
        }
      </td>
      <td style="font-weight: 800; font-size: 1.2rem; color: var(--success, #22c55e);">${total.toFixed(2)}</td>
    </tr>
  `}).join('')

  tfoot.innerHTML = `
    <tr style="font-weight: 800; font-size: 1.2rem; background: var(--surface-hover);">
      <td colspan="5" style="text-align: ${lang === 'ar' ? 'right' : 'left'}; padding: 1.5rem;">${t.total || 'الإجمالي'}</td>
      <td style="color: var(--primary); text-align: center;">${grandBayaawaMeshal.toFixed(2)}<div style="font-size:0.85rem;font-weight:600;color:var(--text-muted);">${t.bs_daily_meshal || 'المشال'}</div></td>
      <td style="color: var(--success, #22c55e);">${grandTotal.toFixed(2)}</td>
    </tr>
  `

  tbody.querySelectorAll('.bs-cell-input').forEach(input => {
    input.addEventListener('change', async () => {
      if (input.readOnly) return

      const tr = input.closest('tr')
      const index = tr.dataset.index
      const id = tr.dataset.id
      const catId = tr.dataset.catid
      const field = input.dataset.field
      const value = parseFloat(input.value) || 0

      const row = salesData[index]
      row[field] = value
      
      const branchToUpdate = isSouqView ? selectedBranchId : (localStorage.getItem('aswaq_branch_id') || '')

      if (id) {
        const { error } = await supabase.from('branch_sales').update({ [field]: value }).eq('id', id)
        if (error) Dialog.alert('Error: ' + error.message)
      } else {
        const { data: upserted, error } = await supabase
          .from('branch_sales')
          .upsert([{
            branch_id: branchToUpdate,
            sale_date: selectedDate,
            product_name: row.product_name,
            category_id: catId,
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
}
