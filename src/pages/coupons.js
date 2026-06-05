import { supabase } from '../lib/supabase.js'
import { translations } from '../lib/translations.js'

export async function render() {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  return `
    <div class="header">
      <div>
        <h2 style="font-size: 1.875rem; font-weight: 800; color: var(--text);">${lang === 'ar' ? 'الكوبونات' : 'Coupons'}</h2>
        <p style="color: var(--text-muted);">${lang === 'ar' ? 'إدارة أكواد الخصم الخاصة بكل فرع' : 'Manage discount codes for each branch'}</p>
      </div>
      <button class="btn btn-primary" onclick="openCouponModal()">
        + ${lang === 'ar' ? 'إضافة كوبون' : 'Add Coupon'}
      </button>
    </div>

    <div class="card" style="margin-top: 1.5rem; overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; text-align: ${lang === 'ar' ? 'right' : 'left'};">
        <thead>
          <tr style="border-bottom: 2px solid var(--border); color: var(--text-muted); font-size: 0.875rem;">
            <th style="padding: 1rem;">${lang === 'ar' ? 'الكود' : 'Code'}</th>
            <th style="padding: 1rem;">${lang === 'ar' ? 'الفرع' : 'Branch'}</th>
            <th style="padding: 1rem;">${lang === 'ar' ? 'الخصم' : 'Discount'}</th>
            <th style="padding: 1rem;">${lang === 'ar' ? 'الاستخدام' : 'Usage'}</th>
            <th style="padding: 1rem;">${lang === 'ar' ? 'الحالة' : 'Status'}</th>
            <th style="padding: 1rem;">${lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
          </tr>
        </thead>
        <tbody id="coupons-tbody">
          <tr><td colspan="6" style="padding: 2rem; text-align: center;"><div class="spinner" style="margin: 0 auto;"></div></td></tr>
        </tbody>
      </table>
    </div>

    <div id="coupon-modal" class="modal">
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3 id="modal-title" style="font-size: 1.25rem; font-weight: 800;">${lang === 'ar' ? 'إضافة كوبون' : 'Add Coupon'}</h3>
          <button class="btn-icon" onclick="closeCouponModal()">✕</button>
        </div>
        <form id="coupon-form" onsubmit="handleSaveCoupon(event)">
          <input type="hidden" id="coupon_id">
          
          <div class="form-group">
            <label class="form-label">${lang === 'ar' ? 'كود الخصم' : 'Coupon Code'} *</label>
            <input type="text" class="input" id="c_code" required placeholder="e.g. SUMMER20" style="text-transform: uppercase;">
          </div>
          
          <div class="form-group">
            <label class="form-label">${lang === 'ar' ? 'الفرع' : 'Branch'} *</label>
            <select class="input" id="c_branch_id" required></select>
          </div>
          
          <div style="display: flex; gap: 1rem;">
            <div class="form-group" style="flex: 1;">
              <label class="form-label">${lang === 'ar' ? 'نوع الخصم' : 'Discount Type'} *</label>
              <select class="input" id="c_discount_type" required>
                <option value="percentage">% ${lang === 'ar' ? 'نسبة مئوية' : 'Percentage'}</option>
                <option value="fixed">${lang === 'ar' ? 'قيمة ثابتة' : 'Fixed Amount'}</option>
              </select>
            </div>
            
            <div class="form-group" style="flex: 1;">
              <label class="form-label">${lang === 'ar' ? 'القيمة' : 'Value'} *</label>
              <input type="number" step="0.01" class="input" id="c_discount_value" required>
            </div>
          </div>
          
          <div style="display: flex; gap: 1rem;">
            <div class="form-group" style="flex: 1;">
              <label class="form-label">${lang === 'ar' ? 'حد أقصى للخصم (لنسبة مئوية)' : 'Max Discount Amount'}</label>
              <input type="number" step="0.01" class="input" id="c_max_discount_amount">
            </div>
            
            <div class="form-group" style="flex: 1;">
              <label class="form-label">${lang === 'ar' ? 'مرات الاستخدام المسموحة' : 'Usage Limit'}</label>
              <input type="number" class="input" id="c_usage_limit" value="100">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">
              <input type="checkbox" id="c_is_active" checked> 
              ${lang === 'ar' ? 'مفعل' : 'Active'}
            </label>
          </div>
          
          <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem;">
            <button type="button" class="btn" onclick="closeCouponModal()">${lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" class="btn btn-primary">${lang === 'ar' ? 'حفظ' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  `
}

export async function attachEvents() {
  await fetchCoupons()
  await populateBranches()
}

async function populateBranches() {
  const { data } = await supabase.from('branches').select('id, name, name_en').eq('is_active', true)
  if (data) {
    const lang = localStorage.getItem('aswaq_lang') || 'ar'
    const select = document.getElementById('c_branch_id')
    select.innerHTML = '<option value="">' + (lang === 'ar' ? 'اختر الفرع...' : 'Select Branch...') + '</option>' +
      data.map(b => \`<option value="\${b.id}">\${lang === 'ar' ? b.name : (b.name_en || b.name)}</option>\`).join('')
  }
}

async function fetchCoupons() {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const { data, error } = await supabase
    .from('coupons')
    .select('*, branches(name, name_en)')
    .order('created_at', { ascending: false })

  const tbody = document.getElementById('coupons-tbody')
  
  if (error) {
    console.error(error)
    tbody.innerHTML = \`<tr><td colspan="6" style="padding: 1rem; color: var(--danger); text-align: center;">\${lang === 'ar' ? 'حدث خطأ' : 'Error loading data'}</td></tr>\`
    return
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = \`<tr><td colspan="6" style="padding: 2rem; color: var(--text-muted); text-align: center;">\${lang === 'ar' ? 'لا توجد كوبونات' : 'No coupons found'}</td></tr>\`
    return
  }

  tbody.innerHTML = data.map(c => {
    const branchName = c.branches ? (lang === 'ar' ? c.branches.name : (c.branches.name_en || c.branches.name)) : '—'
    const discountStr = c.discount_type === 'percentage' 
      ? \`\${c.discount_value}% \${c.max_discount_amount ? '(Max: '+c.max_discount_amount+')' : ''}\`
      : \`\${c.discount_value} EGP\`
      
    const statusBadge = c.is_active 
      ? \`<span class="badge" style="background: var(--success-bg); color: var(--success);">\${lang === 'ar' ? 'مفعل' : 'Active'}</span>\`
      : \`<span class="badge" style="background: var(--danger-bg); color: var(--danger);">\${lang === 'ar' ? 'معطل' : 'Disabled'}</span>\`

    return \`
      <tr style="border-bottom: 1px solid var(--border);">
        <td style="padding: 1rem; font-weight: 700; color: var(--primary);">\${c.code}</td>
        <td style="padding: 1rem;">\${branchName}</td>
        <td style="padding: 1rem;">\${discountStr}</td>
        <td style="padding: 1rem;">\${c.used_count} / \${c.usage_limit}</td>
        <td style="padding: 1rem;">\${statusBadge}</td>
        <td style="padding: 1rem;">
          <button class="btn-icon" onclick="window.editCoupon('\${c.id}')" title="Edit">✏️</button>
          <button class="btn-icon" onclick="window.deleteCoupon('\${c.id}')" style="color: var(--danger);" title="Delete">🗑️</button>
        </td>
      </tr>
    \`
  }).join('')
}

window.openCouponModal = () => {
  document.getElementById('coupon-form').reset()
  document.getElementById('coupon_id').value = ''
  document.getElementById('coupon-modal').classList.add('active')
}

window.closeCouponModal = () => {
  document.getElementById('coupon-modal').classList.remove('active')
}

window.handleSaveCoupon = async (e) => {
  e.preventDefault()
  const id = document.getElementById('coupon_id').value
  const code = document.getElementById('c_code').value.toUpperCase().trim()
  const branch_id = document.getElementById('c_branch_id').value
  const discount_type = document.getElementById('c_discount_type').value
  const discount_value = document.getElementById('c_discount_value').value
  const max_discount_amount = document.getElementById('c_max_discount_amount').value || null
  const usage_limit = document.getElementById('c_usage_limit').value || 1
  const is_active = document.getElementById('c_is_active').checked

  const payload = {
    code, branch_id, discount_type, discount_value, 
    max_discount_amount, usage_limit, is_active
  }

  const { error } = id 
    ? await supabase.from('coupons').update(payload).eq('id', id)
    : await supabase.from('coupons').insert([payload])

  if (error) {
    if (error.code === '23505') {
      alert('Code must be unique per branch.')
    } else {
      alert('Error saving coupon: ' + error.message)
    }
  } else {
    closeCouponModal()
    fetchCoupons()
  }
}

window.editCoupon = async (id) => {
  const { data, error } = await supabase.from('coupons').select('*').eq('id', id).single()
  if (data) {
    document.getElementById('coupon_id').value = data.id
    document.getElementById('c_code').value = data.code
    document.getElementById('c_branch_id').value = data.branch_id
    document.getElementById('c_discount_type').value = data.discount_type
    document.getElementById('c_discount_value').value = data.discount_value
    document.getElementById('c_max_discount_amount').value = data.max_discount_amount || ''
    document.getElementById('c_usage_limit').value = data.usage_limit
    document.getElementById('c_is_active').checked = data.is_active
    document.getElementById('coupon-modal').classList.add('active')
  }
}

window.deleteCoupon = async (id) => {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  if (confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا الكوبون؟' : 'Are you sure you want to delete this coupon?')) {
    await supabase.from('coupons').delete().eq('id', id)
    fetchCoupons()
  }
}
