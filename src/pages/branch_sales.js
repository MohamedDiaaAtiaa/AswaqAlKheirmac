import { supabase } from '../lib/supabase.js'
import { translations } from '../lib/translations.js'
import { Dialog } from '../lib/dialog.js'

let salesData = []
let branches = []
let categories = []
let souqProducts = []
let isSouqView = false
let selectedBranchId = 'all' // default to all for souq
let selectedDate = new Date().toISOString().split('T')[0]

export async function loadBranchSales(container, souqMode = false) {
  isSouqView = souqMode
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  const headerActions = document.getElementById('header-actions')
  headerActions.innerHTML = `
    <button id="add-bs-row-btn" class="btn-primary">
      <span>+</span> ${t.bs_add_row || 'إضافة صف'}
    </button>
  `

  // Fetch branches and categories
  const [branchesRes, categoriesRes, souqProductsRes] = await Promise.all([
    supabase.from('branches').select('id, name, name_en').eq('is_active', true),
    supabase.from('app_settings').select('value').eq('key', 'categories').single(),
    supabase.from('app_settings').select('value').eq('key', 'souq_products').single()
  ])

  branches = branchesRes.data || []
  categories = categoriesRes.data?.value || []
  
  if (souqProductsRes.data) {
    souqProducts = souqProductsRes.data.value || []
  } else {
    // Initialize souq_products from May 22nd as requested
    const { data: may22 } = await supabase.from('branch_sales').select('*').eq('sale_date', '2026-05-22')
    if (may22 && may22.length > 0) {
      const unique = new Set()
      may22.forEach(r => {
        if (r.product_name && !unique.has(r.product_name)) {
          unique.add(r.product_name)
          souqProducts.push({
            product_name: r.product_name,
            category_id: r.category_id,
            image_url: r.product_image_url || r.image_url,
            emoji: r.emoji || '📦'
          })
        }
      })
      await supabase.from('app_settings').upsert({ key: 'souq_products', value: souqProducts }, { onConflict: 'key' })
    }
  }

  const currentBranchId = localStorage.getItem('aswaq_branch_id') || ''
  if (!isSouqView) {
    selectedBranchId = currentBranchId
  } else {
    const loggedInBranch = JSON.parse(localStorage.getItem('aswaq_logged_branch') || 'null')
    selectedBranchId = loggedInBranch?.is_default ? currentBranchId : 'all'
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
            <th style="font-size: 1.1rem; padding: 1rem;">${t.actions || 'إجراءات'}</th>
          </tr>
        </thead>
        <tbody id="bs-tbody">
          <tr><td colspan="8" style="text-align: center; padding: 2rem; font-size: 1.2rem;">${t.loading}</td></tr>
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

  document.getElementById('add-bs-row-btn').addEventListener('click', () => {
    // Add an empty row for a custom product
    salesData.push({
      branch_id: isSouqView ? selectedBranchId : (localStorage.getItem('aswaq_branch_id') || ''),
      sale_date: selectedDate,
      product_name: '',
      category_id: null,
      display_name: '',
      emoji: '📦',
      image_url: null,
      quantity: 0,
      count: 0,
      price: 0,
      meshal: 0,
      is_custom: true
    })
    renderTable()
  })

  await fetchSalesData()
}

async function fetchSalesData() {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const tbody = document.getElementById('bs-tbody')
  if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; font-size: 1.2rem;">${translations[lang].loading}</td></tr>`

  // 1. Fetch all sales for the selected date to build the unified item list
  const { data: allSales, error } = await supabase
    .from('branch_sales')
    .select('*')
    .eq('sale_date', selectedDate)

  if (error) {
    console.error(error)
    salesData = []
    renderTable()
    return
  }

  // 2. Extract unique products starting from our permanent Souq template
  const uniqueProducts = [...souqProducts]
  
  // Add any products from today's sales that might not be in the template yet
  allSales.forEach(row => {
    if (row.product_name && !uniqueProducts.find(p => p.product_name === row.product_name)) {
      uniqueProducts.push({
        product_name: row.product_name,
        category_id: row.category_id,
        image_url: row.image_url,
        emoji: row.emoji || '📦'
      })
    }
  })

  // 3. Render logic
  if (isSouqView && selectedBranchId === 'all') {
    const aggregated = {}
    
    uniqueProducts.forEach(up => {
      aggregated[up.product_name] = {
        is_aggregated: true,
        product_name: up.product_name,
        display_name: up.product_name,
        emoji: up.emoji,
        image_url: up.image_url,
        category_id: up.category_id,
        quantity: 0, count: 0, price: 0, meshal: 0, total: 0
      }
    })

    allSales.forEach(row => {
      const target = aggregated[row.product_name]
      if (target) {
        target.quantity += (row.quantity || 0)
        target.count += (parseFloat(row.count) || 0)
        target.meshal += (parseFloat(row.meshal) || 0)
        const w = parseFloat(row.count) || 0
        const p = parseFloat(row.price) || 0
        const m = parseFloat(row.meshal) || 0
        target.total += (w * p) + m
      }
    })

    salesData = Object.values(aggregated)
  } else {
    // Specific branch view
    const branchToFetch = isSouqView ? selectedBranchId : (localStorage.getItem('aswaq_branch_id') || '')
    const branchSales = allSales.filter(r => r.branch_id === branchToFetch)
    
    salesData = uniqueProducts.map(up => {
      const existing = branchSales.find(r => r.product_name === up.product_name)
      if (existing) {
        return {
          ...existing,
          display_name: existing.product_name,
          emoji: existing.emoji || up.emoji,
          image_url: existing.image_url || up.image_url
        }
      } else {
        return {
          branch_id: branchToFetch,
          sale_date: selectedDate,
          product_name: up.product_name,
          category_id: up.category_id,
          display_name: up.product_name,
          emoji: up.emoji,
          image_url: up.image_url,
          quantity: 0, count: 0, price: 0, meshal: 0
        }
      }
    })
  }

  renderTable()
}

function renderTable() {
  const tbody = document.getElementById('bs-tbody')
  const tfoot = document.getElementById('bs-tfoot')
  if (!tbody) return

  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  if (salesData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem; font-size: 1.2rem;">${t.bs_no_data || 'لا توجد بيانات'}</td></tr>`
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
    const canEditQuantity = !isAggregated // branch can edit quantity, market can too
    const canEditCountAndMeshal = !isAggregated // branch and market can edit weight and meshal
    const canEditPrice = !isAggregated && isSouqView // only market can edit price

    const imageHtml = row.image_url 
      ? `<img src="${row.image_url}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;">`
      : `<span style="font-size: 1.8rem;">${row.emoji || '📦'}</span>`

    return `
    <tr data-id="${row.id || ''}" data-index="${index}" data-catid="${row.category_id || ''}">
      <td style="text-align: center; padding: 0.5rem;">${imageHtml}</td>
      <td style="font-weight: 700; font-size: 1.1rem;">
        ${isAggregated ? 
          (row.display_name || row.product_name) : 
          `<input type="text" class="bs-cell-input" data-field="product_name" value="${row.display_name || row.product_name}" placeholder="${lang === 'ar' ? 'اسم الصنف...' : 'Item name...'}" style="font-size: 1.1rem; padding: 0.5rem; width: 100%; min-width: 150px; border: 1px solid var(--border); border-radius: 6px;">`
        }
      </td>
      <td>
        ${isAggregated ? 
          `<div style="font-size: 1.2rem; font-weight: bold; text-align: center;">${row.quantity}</div>` : 
          `<input type="text" inputmode="decimal" class="bs-cell-input" data-field="quantity" value="${row.quantity || 0}" 
          ${canEditQuantity ? '' : 'readonly'} style="font-size: 1.1rem; padding: 0.5rem; max-width: 120px;">`
        }
      </td>
      <td>
        ${isAggregated ? 
          `<div style="font-size: 1.2rem; font-weight: bold; text-align: center;">${weight.toFixed(2)}</div>` : 
          `<input type="text" inputmode="decimal" class="bs-cell-input" data-field="count" value="${weight.toFixed(2)}" 
          ${canEditCountAndMeshal ? '' : 'readonly'} style="font-size: 1.1rem; padding: 0.5rem; max-width: 120px;">`
        }
      </td>
      <td>
        ${isAggregated ? 
          `<div style="font-size: 1.2rem; text-align: center; color: var(--text-muted);">-</div>` : 
          `<input type="text" inputmode="decimal" class="bs-cell-input" data-field="price" value="${price.toFixed(2)}" 
          ${canEditPrice ? '' : 'readonly'} style="font-size: 1.1rem; padding: 0.5rem; max-width: 120px;">`
        }
      </td>
      <td>
        ${isAggregated ? 
          `<div style="font-size: 1.2rem; font-weight: bold; text-align: center;">${bayaawaMeshal.toFixed(2)}</div>` : 
          `<input type="text" inputmode="decimal" class="bs-cell-input" data-field="meshal" value="${bayaawaMeshal.toFixed(2)}" 
          ${canEditCountAndMeshal ? '' : 'readonly'} style="font-size: 1.1rem; padding: 0.5rem; max-width: 120px;">`
        }
      </td>
      <td style="font-weight: 800; font-size: 1.2rem; color: var(--success, #22c55e);">${total.toFixed(2)}</td>
      <td style="text-align: center;">
        ${isAggregated ? '' : `<button class="btn-icon delete-bs-row-btn" data-id="${row.id || ''}" data-index="${index}" style="color: var(--error); margin: 0 auto; font-size: 1.2rem;" title="${t.delete || 'حذف'}">🗑️</button>`}
      </td>
    </tr>
  `}).join('')

  tfoot.innerHTML = `
    <tr style="font-weight: 800; font-size: 1.2rem; background: var(--surface-hover);">
      <td colspan="5" style="text-align: ${lang === 'ar' ? 'right' : 'left'}; padding: 1.5rem;">${t.total || 'الإجمالي'}</td>
      <td style="color: var(--primary); text-align: center;">${grandBayaawaMeshal.toFixed(2)}<div style="font-size:0.85rem;font-weight:600;color:var(--text-muted);">${t.bs_daily_meshal || 'المشال'}</div></td>
      <td style="color: var(--success, #22c55e);">${grandTotal.toFixed(2)}</td>
      <td></td>
    </tr>
  `

  // Helper: recalculate a single row's total and update grand totals in the footer
  function recalcRowAndTotals(tr, index) {
    const row = salesData[index]
    if (!row || row.is_aggregated) return

    const weight = parseFloat(row.count) || 0
    const price = parseFloat(row.price) || 0
    const meshal = parseFloat(row.meshal) || 0
    const total = (weight * price) + meshal

    // Update the total cell in this row (7th column, index 6)
    const totalCell = tr.querySelectorAll('td')[6]
    if (totalCell) totalCell.textContent = total.toFixed(2)

    // Recalculate grand totals across all rows
    let grandBayaawaMeshal = 0
    let grandTotal = 0
    salesData.forEach((r, i) => {
      const w = parseFloat(r.count) || 0
      const p = parseFloat(r.price) || 0
      const m = parseFloat(r.meshal) || 0
      let t = 0
      if (r.is_aggregated) {
        t = r.total || 0
      } else {
        t = (w * p) + m
      }
      grandBayaawaMeshal += m
      grandTotal += t
    })

    const tfoot = document.getElementById('bs-tfoot')
    if (tfoot) {
      const footerCells = tfoot.querySelectorAll('td')
      if (footerCells.length >= 3) {
        // Update meshal total (2nd cell) and grand total (3rd cell)
        footerCells[1].innerHTML = `${grandBayaawaMeshal.toFixed(2)}<div style="font-size:0.85rem;font-weight:600;color:var(--text-muted);">${t.bs_daily_meshal || 'المشال'}</div>`
        footerCells[2].textContent = grandTotal.toFixed(2)
      }
    }
  }

  tbody.querySelectorAll('.bs-cell-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    });

    // Real-time calculation as the user types
    input.addEventListener('input', () => {
      if (input.readOnly) return
      const tr = input.closest('tr')
      const index = parseInt(tr.dataset.index)
      const field = input.dataset.field
      const row = salesData[index]
      if (!row) return

      if (field !== 'product_name') {
        let val = String(input.value).replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 1776)
        row[field] = parseFloat(val) || 0
      } else {
        row[field] = input.value
        row.display_name = input.value
      }

      recalcRowAndTotals(tr, index)
    })

    // Save to database on blur/change
    input.addEventListener('change', async () => {
      if (input.readOnly) return

      const tr = input.closest('tr')
      const index = parseInt(tr.dataset.index)
      const id = tr.dataset.id
      const field = input.dataset.field
      let value = input.value
      if (field !== 'product_name') {
        value = String(value).replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 1776)
        value = parseFloat(value) || 0
      }

      const row = salesData[index]
      row[field] = value
      
      // Update the total cell immediately
      recalcRowAndTotals(tr, index)

      const branchToUpdate = isSouqView ? selectedBranchId : (localStorage.getItem('aswaq_branch_id') || '')

      if (!row.product_name) {
        // Can't save without product name
        return
      }

      if (field === 'product_name') {
        const existingSouq = souqProducts.find(p => p.product_name === value)
        if (!existingSouq) {
          souqProducts.push({
            product_name: value,
            category_id: row.category_id,
            image_url: row.image_url,
            emoji: row.emoji || '📦'
          })
          supabase.from('app_settings').upsert({ key: 'souq_products', value: souqProducts }, { onConflict: 'key' }).then(() => {
            console.log('Added to Souq template')
          })
        }

        if (!row.category_id) {
          const existingCat = categories.find(c => c.label_ar === value || c.label_en === value)
          if (!existingCat) {
            const catId = value.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || ('cat_' + Date.now())
            const finalId = categories.find(c => c.id === catId) ? catId + '_' + Date.now() : catId
            const newCat = { id: finalId, label_ar: value, label_en: value, emoji: '📦', image_url: '' }
            categories.push(newCat)
            row.category_id = finalId
            
            // Save to global app_settings
            supabase.from('app_settings').upsert({ key: 'categories', value: categories }, { onConflict: 'key' }).then(() => {
              console.log('Category added globally')
            })
          } else {
            row.category_id = existingCat.id
          }
        }
      }

      if (id) {
        const payload = { [field]: value }
        
        const { error } = await supabase.from('branch_sales').update(payload).eq('id', id)
        if (error) Dialog.alert('Error: ' + error.message)
      } else {
        const { data: upserted, error } = await supabase
          .from('branch_sales')
          .upsert([{
            branch_id: branchToUpdate,
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
      // Don't call renderTable() here — it destroys the inputs and loses focus
    })
  })

  tbody.querySelectorAll('.delete-bs-row-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = btn.dataset.index
      const id = btn.dataset.id
      const row = salesData[index]
      
      if (await Dialog.confirm(t.confirm_delete || 'هل أنت متأكد من الحذف؟')) {
        if (id) {
          const { error } = await supabase.from('branch_sales').delete().eq('id', id)
          if (error) {
            Dialog.alert('Error: ' + error.message)
            return
          }
        }
        
        // Remove from persistent Souq template
        if (row && row.product_name) {
          const sIdx = souqProducts.findIndex(p => p.product_name === row.product_name)
          if (sIdx !== -1) {
            souqProducts.splice(sIdx, 1)
            await supabase.from('app_settings').upsert({ key: 'souq_products', value: souqProducts }, { onConflict: 'key' })
          }
        }
        
        salesData.splice(index, 1)
        renderTable()
      }
    })
  })
}
