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
      <h3 style="margin: 0 0 1.25rem 0; font-size: 1.1rem;">${t.add_category || 'إضافة فئة'}</h3>
      <div class="form-grid" style="grid-template-columns: 1fr 1fr 1fr 80px auto; align-items: flex-end; gap: 0.75rem;">
        <div class="input-group" style="margin:0;">
          <label style="font-size: 0.75rem;">${t.category_id || 'المعرف'}</label>
          <input type="text" id="new-cat-id" placeholder="dairy" dir="ltr">
        </div>
        <div class="input-group" style="margin:0;">
          <label style="font-size: 0.75rem;">${t.category_name_ar || 'الاسم (عربي)'}</label>
          <input type="text" id="new-cat-label-ar" placeholder="ألبان" dir="rtl">
        </div>
        <div class="input-group" style="margin:0;">
          <label style="font-size: 0.75rem;">${t.category_name_en || 'الاسم (إنجليزي)'}</label>
          <input type="text" id="new-cat-label-en" placeholder="Dairy" dir="ltr">
        </div>
        <div class="input-group" style="margin:0;">
          <label style="font-size: 0.75rem;">${t.category_emoji || 'الرمز'}</label>
          <input type="text" id="new-cat-emoji" placeholder="🥛">
        </div>
        <button id="add-cat-btn" class="btn-primary" style="height: 48px; min-width: 48px; margin-bottom: 0; font-size: 1.25rem;">+</button>
      </div>
    </div>
    <div class="card" style="padding: 0;">
      <div class="table-container" style="margin: 0;">
        <table>
          <thead>
            <tr>
              <th>${t.category_emoji || 'الرمز'}</th>
              <th>${t.category_id || 'المعرف'}</th>
              <th>${t.category_name_ar || 'الاسم (عربي)'}</th>
              <th>${t.category_name_en || 'الاسم (إنجليزي)'}</th>
              <th>${t.actions || 'الإجراءات'}</th>
            </tr>
          </thead>
          <tbody id="cats-tbody">
            <tr><td colspan="5" style="text-align: center;">${t.loading}</td></tr>
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

function renderCategoriesTable() {
  const tbody = document.getElementById('cats-tbody')
  if (!tbody) return

  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  if (categories.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">${t.no_categories || 'لا توجد فئات.'}</td></tr>`
    return
  }

  tbody.innerHTML = categories.map((c, i) => `
    <tr>
      <td style="font-size: 1.5rem; text-align: center;">${c.emoji || '📦'}</td>
      <td><code style="background: var(--surface-hover); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">${c.id}</code></td>
      <td style="font-weight: 600;">${c.label_ar || '—'}</td>
      <td>${c.label_en || '—'}</td>
      <td>
        <button class="btn-secondary delete-cat-btn" data-index="${i}" style="padding: 0.25rem 0.75rem; font-size: 0.75rem; color: var(--error); border-color: var(--error);">
          ${t.delete || 'حذف'}
        </button>
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
}

async function handleAddCategory() {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

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
    await saveCategories()
    renderCategoriesTable()
  } else {
    await Dialog.alert(t.error_unique_id || 'يرجى إدخال معرف فريد وصالح واسم.')
  }
}
