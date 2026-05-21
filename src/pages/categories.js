import { supabase } from '../lib/supabase.js'
import { translations } from '../lib/translations.js'
import { Dialog } from '../lib/dialog.js'

let categories = []

export async function loadCategories(container) {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  const headerActions = document.getElementById('header-actions')
  headerActions.innerHTML = ''

  container.innerHTML = `
    <div class="card" style="margin-bottom: 1.5rem; padding: 1.5rem;">
      <h3 style="margin: 0 0 1.25rem 0; font-size: 1.2rem;">${t.add_category || 'إضافة فئة'}</h3>
      <div class="form-grid" style="grid-template-columns: 1fr 1fr 1fr 100px 100px auto; align-items: flex-end; gap: 0.75rem;">
        <div class="input-group" style="margin:0;">
          <label style="font-size: 0.85rem;">${t.category_id || 'المعرف'}</label>
          <input type="text" id="new-cat-id" placeholder="dairy" dir="ltr" style="font-size: 1rem; padding: 0.875rem;">
        </div>
        <div class="input-group" style="margin:0;">
          <label style="font-size: 0.85rem;">${t.category_name_ar || 'الاسم (عربي)'}</label>
          <input type="text" id="new-cat-label-ar" placeholder="ألبان" dir="rtl" style="font-size: 1rem; padding: 0.875rem;">
        </div>
        <div class="input-group" style="margin:0;">
          <label style="font-size: 0.85rem;">${t.category_name_en || 'الاسم (إنجليزي)'}</label>
          <input type="text" id="new-cat-label-en" placeholder="Dairy" dir="ltr" style="font-size: 1rem; padding: 0.875rem;">
        </div>
        <div class="input-group" style="margin:0;">
          <label style="font-size: 0.85rem;">الصورة (URL)</label>
          <input type="text" id="new-cat-image" placeholder="https://" dir="ltr" style="font-size: 1rem; padding: 0.875rem;">
        </div>
        <div class="input-group" style="margin:0;">
          <label style="font-size: 0.85rem;">${t.category_emoji || 'الرمز'}</label>
          <input type="text" id="new-cat-emoji" placeholder="🥛" style="font-size: 1.2rem; padding: 0.875rem;">
        </div>
        <button id="add-cat-btn" class="btn-primary" style="height: 52px; min-width: 52px; margin-bottom: 0; font-size: 1.5rem;">+</button>
      </div>
    </div>
    <div class="card" style="padding: 0;">
      <div class="table-container" style="margin: 0;">
        <table>
          <thead>
            <tr>
              <th style="font-size: 0.9rem;">${t.category_emoji || 'الرمز'} / الصورة</th>
              <th style="font-size: 0.9rem;">${t.category_id || 'المعرف'}</th>
              <th style="font-size: 0.9rem;">${t.category_name_ar || 'الاسم (عربي)'}</th>
              <th style="font-size: 0.9rem;">${t.category_name_en || 'الاسم (إنجليزي)'}</th>
              <th style="font-size: 0.9rem;">${t.actions || 'الإجراءات'}</th>
            </tr>
          </thead>
          <tbody id="cats-tbody">
            <tr><td colspan="5" style="text-align: center; font-size: 1.1rem;">${t.loading}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `

  await fetchCategories()
  renderCategoriesTable()

  document.getElementById('add-cat-btn').addEventListener('click', handleAddCategory)
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
    { id: 'dairy', label_ar: 'ألبان', label_en: 'Dairy', emoji: '🥛', image_url: '' },
    { id: 'fruits', label_ar: 'فواكه', label_en: 'Fruits', emoji: '🍎', image_url: '' },
    { id: 'vegetables', label_ar: 'خضروات', label_en: 'Vegetables', emoji: '🥦', image_url: '' },
    { id: 'meat', label_ar: 'لحوم', label_en: 'Meat', emoji: '🥩', image_url: '' },
    { id: 'bakery', label_ar: 'مخبوزات', label_en: 'Bakery', emoji: '🥐', image_url: '' }
  ]
}

async function saveCategories() {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'categories', value: categories }, { onConflict: 'key' })

  if (error) await Dialog.alert('Failed to save categories: ' + error.message)
}

function renderCategoriesTable() {
  const tbody = document.getElementById('cats-tbody')
  if (!tbody) return

  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  if (categories.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); font-size: 1.1rem;">${t.no_categories || 'لا توجد فئات.'}</td></tr>`
    return
  }

  tbody.innerHTML = categories.map((c, i) => `
    <tr>
      <td style="font-size: 1.8rem; text-align: center;">
        ${c.image_url ? `<img src="${c.image_url}" alt="${c.label_ar}" style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover; box-shadow: var(--shadow-sm);">` : (c.emoji || '📦')}
      </td>
      <td><code style="background: var(--surface-hover); padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 1rem;">${c.id}</code></td>
      <td style="font-weight: 700; font-size: 1.1rem;">${c.label_ar || '—'}</td>
      <td style="font-size: 1.1rem;">${c.label_en || '—'}</td>
      <td>
        <div class="action-row">
          <button class="btn-secondary edit-cat-btn" data-index="${i}" style="padding: 0.35rem 0.85rem; font-size: 0.85rem;">
            ${t.edit || 'تعديل'}
          </button>
          <button class="btn-secondary delete-cat-btn" data-index="${i}" style="padding: 0.35rem 0.85rem; font-size: 0.85rem; color: var(--error); border-color: var(--error);">
            ${t.delete || 'حذف'}
          </button>
        </div>
      </td>
    </tr>
  `).join('')

  tbody.querySelectorAll('.delete-cat-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = parseInt(btn.dataset.index)
      if (await Dialog.confirm(t.confirm_delete || 'هل أنت متأكد؟')) {
        categories.splice(index, 1)
        await saveCategories()
        renderCategoriesTable()
      }
    })
  })

  tbody.querySelectorAll('.edit-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index)
      openEditCategoryModal(index)
    })
  })
}

async function handleAddCategory() {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  const idInput = document.getElementById('new-cat-id')
  const labelArInput = document.getElementById('new-cat-label-ar')
  const labelEnInput = document.getElementById('new-cat-label-en')
  const emojiInput = document.getElementById('new-cat-emoji')
  const imageInput = document.getElementById('new-cat-image')

  const idVal = idInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
  const labelArVal = labelArInput.value.trim()
  const labelEnVal = labelEnInput.value.trim()
  const emojiVal = emojiInput.value.trim() || '🛒'
  const imageVal = imageInput.value.trim()

  if (idVal && (labelArVal || labelEnVal) && !categories.find(c => c.id === idVal)) {
    categories.push({ id: idVal, label_ar: labelArVal, label_en: labelEnVal, emoji: emojiVal, image_url: imageVal })
    idInput.value = ''
    labelArInput.value = ''
    labelEnInput.value = ''
    emojiInput.value = ''
    imageInput.value = ''
    await saveCategories()
    renderCategoriesTable()
  } else {
    await Dialog.alert(t.error_unique_id || 'يرجى إدخال معرف فريد وصالح واسم.')
  }
}

function openEditCategoryModal(index) {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]
  const cat = categories[index]

  const modalHtml = `
    <div class="modal-overlay" id="edit-cat-overlay">
      <div class="modal" style="max-width: 500px;">
        <div class="modal-header">
          <h3>${t.edit || 'تعديل الفئة'}</h3>
          <button id="close-cat-modal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="edit-cat-form">
            <div class="input-group">
              <label>${t.category_id || 'المعرف'} (لا يمكن تعديله)</label>
              <input type="text" value="${cat.id}" disabled dir="ltr" style="background: #f1f5f9;">
            </div>
            <div class="form-grid">
              <div class="input-group">
                <label>${t.category_name_ar || 'الاسم (عربي)'}</label>
                <input type="text" name="label_ar" value="${cat.label_ar || ''}" dir="rtl" required>
              </div>
              <div class="input-group">
                <label>${t.category_name_en || 'الاسم (إنجليزي)'}</label>
                <input type="text" name="label_en" value="${cat.label_en || ''}" dir="ltr">
              </div>
            </div>
            <div class="form-grid">
              <div class="input-group">
                <label>${t.category_emoji || 'الرمز'}</label>
                <input type="text" name="emoji" value="${cat.emoji || ''}" dir="ltr">
              </div>
              <div class="input-group">
                <label>الصورة (URL)</label>
                <input type="text" name="image_url" value="${cat.image_url || ''}" dir="ltr" placeholder="https://...">
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button id="cancel-cat-modal" class="btn-secondary">${t.cancel || 'إلغاء'}</button>
          <button form="edit-cat-form" type="submit" class="btn-primary" style="width: auto;">${t.save || 'حفظ'}</button>
        </div>
      </div>
    </div>
  `

  document.body.insertAdjacentHTML('beforeend', modalHtml)
  const overlay = document.getElementById('edit-cat-overlay')

  const close = () => overlay.remove()
  document.getElementById('close-cat-modal').addEventListener('click', close)
  document.getElementById('cancel-cat-modal').addEventListener('click', close)

  document.getElementById('edit-cat-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    
    categories[index].label_ar = formData.get('label_ar').trim()
    categories[index].label_en = formData.get('label_en').trim()
    categories[index].emoji = formData.get('emoji').trim() || '📦'
    categories[index].image_url = formData.get('image_url').trim()

    const submitBtn = e.target.closest('.modal').querySelector('.btn-primary')
    submitBtn.disabled = true
    submitBtn.textContent = t.saving || 'جاري الحفظ...'

    await saveCategories()
    
    close()
    renderCategoriesTable()
  })
}
