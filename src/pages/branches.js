import { supabase } from '../lib/supabase.js'
import { translations } from '../lib/translations.js'
import { Dialog } from '../lib/dialog.js'

let branches = []
let deliveryAreas = []
let selectedBranchId = null

export async function loadBranches(container) {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  const headerActions = document.getElementById('header-actions')
  headerActions.innerHTML = `
    <button id="add-branch-btn" class="btn-primary">
      <span>+</span> ${t.add_branch}
    </button>
  `

  container.innerHTML = `
    <div class="branches-layout">
      <!-- Left: Branch List -->
      <div class="branch-list-panel">
        <div class="card" style="margin-bottom: 1.5rem; padding: 1rem;">
          <div class="input-group" style="margin: 0;">
            <input type="text" id="search-branch" placeholder="${t.search_branches}">
          </div>
        </div>
        <div id="branch-cards-container" class="branch-cards-grid">
          <div class="loader">${t.loading}</div>
        </div>
      </div>
      
      <!-- Right: Delivery Areas for selected branch -->
      <div class="delivery-panel" id="delivery-panel">
        <div class="delivery-panel-empty">
          <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🏪</div>
            <h3 style="margin-bottom: 0.5rem;">${t.select_branch_to_manage}</h3>
            <p style="font-size: 0.875rem;">${t.select_branch_hint}</p>
          </div>
        </div>
      </div>
    </div>
  `

  await fetchBranches()
  
  document.getElementById('add-branch-btn').addEventListener('click', () => openBranchModal())
  document.getElementById('search-branch').addEventListener('input', (e) => renderBranches(e.target.value))
}

async function fetchBranches() {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching branches:', error)
    return
  }

  branches = data || []
  renderBranches()
}

async function fetchDeliveryAreas(branchId) {
  const { data, error } = await supabase
    .from('branch_delivery_areas')
    .select('*')
    .eq('branch_id', branchId)
    .order('delivery_fee', { ascending: true })

  if (error) {
    console.error('Error fetching delivery areas:', error)
    return
  }

  deliveryAreas = data || []
  renderDeliveryPanel(branchId)
}

function renderBranches(searchQuery = '') {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]
  const container = document.getElementById('branch-cards-container')
  if (!container) return

  const filtered = branches.filter(b => {
    const q = searchQuery.toLowerCase()
    return (b.name || '').toLowerCase().includes(q) ||
           (b.name_en || '').toLowerCase().includes(q) ||
           (b.address || '').toLowerCase().includes(q)
  })

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="text-align: center; padding: 2rem; color: var(--text-muted);">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🏪</div>
        <p>${t.no_branches}</p>
      </div>
    `
    return
  }

  container.innerHTML = filtered.map(b => {
    const displayName = lang === 'ar' ? (b.name || b.name_en) : (b.name_en || b.name)
    const isSelected = b.id === selectedBranchId
    return `
      <div class="branch-card ${isSelected ? 'branch-card-selected' : ''} ${!b.is_active ? 'branch-card-inactive' : ''}" data-id="${b.id}">
        <div class="branch-card-header">
          <div>
            <div class="branch-card-name">${displayName}</div>
            <div class="branch-card-address">${b.address || '—'}</div>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            ${b.is_default ? `<span class="status-badge" style="background: #dbeafe; color: #1e40af; font-size: 0.7rem;">⭐ ${t.default_branch}</span>` : ''}
            <span class="status-badge ${b.is_active ? 'status-active' : 'status-inactive'}" style="font-size: 0.7rem;">
              ${b.is_active ? t.active : t.inactive}
            </span>
          </div>
        </div>
        <div class="branch-card-footer">
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            📞 ${b.phone || '—'}
          </div>
          <div class="action-row" style="gap: 0.5rem;">
            <button class="btn-secondary select-branch-btn" data-id="${b.id}" style="padding: 0.25rem 0.75rem; font-size: 0.75rem;">
              🚚 ${t.delivery_areas}
            </button>
            <button class="btn-secondary edit-branch-btn" data-id="${b.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
              ${t.edit}
            </button>
            <button class="btn-secondary delete-branch-btn" data-id="${b.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: var(--error);">
              ${t.delete}
            </button>
          </div>
        </div>
      </div>
    `
  }).join('')

  // Attach events
  container.querySelectorAll('.select-branch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedBranchId = btn.dataset.id
      renderBranches()
      fetchDeliveryAreas(selectedBranchId)
    })
  })

  container.querySelectorAll('.edit-branch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const branch = branches.find(b => b.id === btn.dataset.id)
      openBranchModal(branch)
    })
  })

  container.querySelectorAll('.delete-branch-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (await Dialog.confirm(t.confirm_delete)) {
        const { error } = await supabase.from('branches').delete().eq('id', btn.dataset.id)
        if (!error) {
          if (selectedBranchId === btn.dataset.id) selectedBranchId = null
          await fetchBranches()
        } else {
          await Dialog.alert('Error: ' + error.message)
        }
      }
    })
  })
}

function renderDeliveryPanel(branchId) {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]
  const panel = document.getElementById('delivery-panel')
  const branch = branches.find(b => b.id === branchId)
  if (!panel || !branch) return

  const displayName = lang === 'ar' ? (branch.name || branch.name_en) : (branch.name_en || branch.name)

  // Group by zone
  const zoneGroups = {}
  deliveryAreas.forEach(a => {
    const zone = a.zone_label || t.other
    if (!zoneGroups[zone]) zoneGroups[zone] = []
    zoneGroups[zone].push(a)
  })

  const zoneColors = {
    'Zone 25': '#22c55e', 'Zone 30': '#eab308', 'Zone 35': '#3b82f6',
    'Zone 40': '#a855f7', 'Additional': '#f97316'
  }

  const zonesHtml = Object.entries(zoneGroups).map(([zone, areas]) => {
    const color = zoneColors[zone] || '#64748b'
    return `
      <div class="zone-group">
        <div class="zone-header" style="border-left: 4px solid ${color}; padding-left: 0.75rem;">
          <span class="zone-badge" style="background: ${color}20; color: ${color};">${zone}</span>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${areas.length} ${t.areas_count}</span>
        </div>
        <div class="zone-areas">
          ${areas.map(a => `
            <div class="area-row" data-id="${a.id}">
              <div class="area-name">${a.area_name}</div>
              <div class="area-fee">${a.delivery_fee} ${t.currency}</div>
              <button class="btn-icon delete-area-btn" data-id="${a.id}" title="${t.delete}" style="width: 28px; height: 28px; font-size: 0.8rem;">×</button>
            </div>
          `).join('')}
        </div>
      </div>
    `
  }).join('')

  panel.innerHTML = `
    <div class="delivery-panel-header">
      <h3>🚚 ${t.delivery_areas}: ${displayName}</h3>
      <button id="add-area-btn" class="btn-primary" style="padding: 0.5rem 1rem; font-size: 0.8rem;">
        + ${t.add_area}
      </button>
    </div>
    <div class="delivery-panel-body">
      ${deliveryAreas.length === 0 ? `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
          <p>${t.no_delivery_areas}</p>
        </div>
      ` : zonesHtml}
    </div>
    <div class="delivery-panel-summary">
      <div class="summary-stat">
        <div class="summary-stat-value">${deliveryAreas.length}</div>
        <div class="summary-stat-label">${t.total_areas}</div>
      </div>
      <div class="summary-stat">
        <div class="summary-stat-value">${Math.min(...deliveryAreas.map(a => a.delivery_fee)) || 0}</div>
        <div class="summary-stat-label">${t.min_fee}</div>
      </div>
      <div class="summary-stat">
        <div class="summary-stat-value">${Math.max(...deliveryAreas.map(a => a.delivery_fee)) || 0}</div>
        <div class="summary-stat-label">${t.max_fee}</div>
      </div>
    </div>
  `

  // Add area button
  document.getElementById('add-area-btn').addEventListener('click', () => openAreaModal(branchId))

  // Delete area buttons
  panel.querySelectorAll('.delete-area-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { error } = await supabase.from('branch_delivery_areas').delete().eq('id', btn.dataset.id)
      if (!error) {
        await fetchDeliveryAreas(branchId)
      }
    })
  })
}

function openBranchModal(branch = null) {
  const isEdit = !!branch
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  const modalHtml = `
    <div class="modal-overlay" id="branch-modal-overlay">
      <div class="modal" style="max-width: 560px;">
        <div class="modal-header">
          <h3>${isEdit ? t.edit_branch : t.add_branch}</h3>
          <button id="close-branch-modal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="branch-form">
            <div class="form-grid">
              <div class="input-group">
                <label>${t.branch_name_ar}</label>
                <input type="text" name="name" required value="${branch?.name || ''}" dir="rtl">
              </div>
              <div class="input-group">
                <label>${t.branch_name_en}</label>
                <input type="text" name="name_en" value="${branch?.name_en || ''}" dir="ltr">
              </div>
            </div>
            <div class="input-group">
              <label>${t.branch_address}</label>
              <input type="text" name="address" value="${branch?.address || ''}" dir="rtl">
            </div>
            <div class="input-group">
              <label>${t.branch_phone}</label>
              <input type="text" name="phone" value="${branch?.phone || ''}" dir="ltr">
            </div>
            <div class="form-grid">
              <div class="input-group">
                <label>${t.username}</label>
                <input type="text" name="username" value="${branch?.username || ''}" dir="ltr" placeholder="branch_admin">
              </div>
              <div class="input-group">
                <label>${t.password} (${t.optional})</label>
                <input type="password" name="password" value="" dir="ltr" placeholder="${t.leave_empty_no_password}">
              </div>
            </div>
            <div class="input-group">
              <label>${lang === 'ar' ? 'صلاحيات المستخدم' : 'User Role'}</label>
              <select name="user_role" style="padding: 0.5rem; width: 100%; border-radius: 8px; border: 1px solid var(--border);">
                <option value="branch_manager" ${branch?.user_role === 'branch_manager' ? 'selected' : ''}>${lang === 'ar' ? 'مدير فرع (الافتراضي)' : 'Branch Manager (Default)'}</option>
                <option value="market_manager" ${branch?.user_role === 'market_manager' ? 'selected' : ''}>${lang === 'ar' ? 'مدير سوق (صلاحيات كاملة للسوق)' : 'Market Manager (Full Souq Access)'}</option>
                <option value="market_employee" ${branch?.user_role === 'market_employee' ? 'selected' : ''}>${lang === 'ar' ? 'موظف سوق (صلاحيات التعديل في السوق)' : 'Market Employee (Edit Souq)'}</option>
                <option value="branch_employee" ${branch?.user_role === 'branch_employee' ? 'selected' : ''}>${lang === 'ar' ? 'موظف فرع (عرض فقط)' : 'Branch Employee (View Only)'}</option>
                <option value="super_admin" ${branch?.user_role === 'super_admin' ? 'selected' : ''}>${lang === 'ar' ? 'مدير النظام (تحكم كامل)' : 'Super Admin (Full Control)'}</option>
              </select>
            </div>
            <div class="form-grid">
              <div class="input-group">
                <label>📍 ${t.branch_latitude}</label>
                <input type="number" name="latitude" step="0.0000001" value="${branch?.latitude || ''}" dir="ltr" placeholder="30.1234567">
              </div>
              <div class="input-group">
                <label>📍 ${t.branch_longitude}</label>
                <input type="number" name="longitude" step="0.0000001" value="${branch?.longitude || ''}" dir="ltr" placeholder="31.1234567">
              </div>
            </div>
            <p style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 1rem;">💡 ${t.branch_coords_hint}</p>
            <div class="form-grid">
              <div class="input-group" style="display: flex; align-items: center; gap: 1rem; padding-top: 0.5rem;">
                <label style="margin: 0; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                  <input type="checkbox" name="is_active" ${branch?.is_active !== false ? 'checked' : ''} style="width: 18px; height: 18px;">
                  ${t.active}
                </label>
                <label style="margin: 0; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                  <input type="checkbox" name="is_default" ${branch?.is_default ? 'checked' : ''} style="width: 18px; height: 18px;">
                  ${t.default_branch}
                </label>
              </div>
            </div>
            <input type="hidden" name="id" value="${branch?.id || ''}">
          </form>
        </div>
        <div class="modal-footer">
          <button id="cancel-branch-modal" class="btn-secondary">${t.cancel}</button>
          <button form="branch-form" type="submit" class="btn-primary" style="width: auto;">${t.save}</button>
        </div>
      </div>
    </div>
  `

  document.body.insertAdjacentHTML('beforeend', modalHtml)
  const overlay = document.getElementById('branch-modal-overlay')

  const close = () => overlay.remove()
  document.getElementById('close-branch-modal').addEventListener('click', close)
  document.getElementById('cancel-branch-modal').addEventListener('click', close)

  document.getElementById('branch-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const submitBtn = e.target.closest('.modal').querySelector('.btn-primary')
    submitBtn.disabled = true
    submitBtn.textContent = t.saving

    const payload = {
      name: formData.get('name'),
      name_en: formData.get('name_en') || null,
      address: formData.get('address') || null,
      phone: formData.get('phone') || null,
      latitude: formData.get('latitude') ? parseFloat(formData.get('latitude')) : null,
      longitude: formData.get('longitude') ? parseFloat(formData.get('longitude')) : null,
      is_active: formData.get('is_active') === 'on',
      is_default: formData.get('is_default') === 'on',
      username: formData.get('username') || null,
      password_hash: formData.get('password') ? formData.get('password') : null,
      user_role: formData.get('user_role') || 'branch_manager'
    }

    const id = formData.get('id')
    let error

    if (id) {
      ({ error } = await supabase.from('branches').update(payload).eq('id', id))
    } else {
      ({ error } = await supabase.from('branches').insert([payload]))
    }

    if (error) {
      await Dialog.alert('Error: ' + error.message)
      submitBtn.disabled = false
      submitBtn.textContent = t.save
    } else {
      close()
      await fetchBranches()
    }
  })
}

function openAreaModal(branchId) {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  const modalHtml = `
    <div class="modal-overlay" id="area-modal-overlay">
      <div class="modal" style="max-width: 480px;">
        <div class="modal-header">
          <h3>${t.add_area}</h3>
          <button id="close-area-modal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="area-form">
            <div class="input-group">
              <label>${t.area_name}</label>
              <input type="text" name="area_name" required placeholder="${t.area_name_placeholder}" dir="rtl">
            </div>
            <div class="form-grid">
              <div class="input-group">
                <label>${t.delivery_fee_label}</label>
                <input type="number" name="delivery_fee" required step="0.01" min="0" placeholder="25">
              </div>
              <div class="input-group">
                <label>${t.zone_label}</label>
                <select name="zone_label" class="form-textarea" style="min-height: 48px; padding: 0.5rem 1rem;">
                  <option value="Zone 25">🟢 Zone 25</option>
                  <option value="Zone 30">🟡 Zone 30</option>
                  <option value="Zone 35">🔵 Zone 35</option>
                  <option value="Zone 40">🟣 Zone 40</option>
                  <option value="Additional">🟠 ${t.additional}</option>
                </select>
              </div>
            </div>
            <hr style="border: none; border-top: 1px dashed var(--border); margin: 1rem 0;">
            <p style="font-size: 0.75rem; color: var(--text-muted);">💡 ${t.bulk_add_hint}</p>
            <div class="input-group">
              <label>${t.bulk_add}</label>
              <textarea name="bulk_areas" class="form-textarea" style="min-height: 80px;" dir="rtl" placeholder="${t.bulk_add_placeholder}"></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button id="cancel-area-modal" class="btn-secondary">${t.cancel}</button>
          <button form="area-form" type="submit" class="btn-primary" style="width: auto;">${t.save}</button>
        </div>
      </div>
    </div>
  `

  document.body.insertAdjacentHTML('beforeend', modalHtml)
  const overlay = document.getElementById('area-modal-overlay')

  const close = () => overlay.remove()
  document.getElementById('close-area-modal').addEventListener('click', close)
  document.getElementById('cancel-area-modal').addEventListener('click', close)

  document.getElementById('area-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const submitBtn = e.target.closest('.modal').querySelector('.btn-primary')
    submitBtn.disabled = true
    submitBtn.textContent = t.saving

    const bulkText = formData.get('bulk_areas')?.trim()
    const zoneLabelVal = formData.get('zone_label')
    const feeVal = parseFloat(formData.get('delivery_fee')) || 0

    const areasToInsert = []

    // Bulk mode: each line is "area_name" or "area_name → fee"
    if (bulkText) {
      const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
      for (const line of lines) {
        // Support formats: "area → 25" or "area = 25" or just "area"
        const match = line.match(/^(.+?)(?:\s*[→=\-:]\s*(\d+(?:\.\d+)?))?$/)
        if (match) {
          areasToInsert.push({
            branch_id: branchId,
            area_name: match[1].trim(),
            zone_label: zoneLabelVal,
            delivery_fee: match[2] ? parseFloat(match[2]) : feeVal
          })
        }
      }
    }

    // Single area mode
    const singleName = formData.get('area_name')?.trim()
    if (singleName && areasToInsert.length === 0) {
      areasToInsert.push({
        branch_id: branchId,
        area_name: singleName,
        zone_label: zoneLabelVal,
        delivery_fee: feeVal
      })
    }

    if (areasToInsert.length === 0) {
      await Dialog.alert(t.error_no_areas)
      submitBtn.disabled = false
      submitBtn.textContent = t.save
      return
    }

    const { error } = await supabase.from('branch_delivery_areas').insert(areasToInsert)

    if (error) {
      await Dialog.alert('Error: ' + error.message)
      submitBtn.disabled = false
      submitBtn.textContent = t.save
    } else {
      close()
      await fetchDeliveryAreas(branchId)
    }
  })
}
