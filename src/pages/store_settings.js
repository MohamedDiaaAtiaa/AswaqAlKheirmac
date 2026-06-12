import { supabase } from '../lib/supabase.js'
import { translations } from '../lib/translations.js'
import { Dialog } from '../lib/dialog.js'

let storeInfo = {}

export async function loadStoreSettings(container) {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  document.getElementById('header-actions').innerHTML = ''

  container.innerHTML = `<div class="loader">${t.loading}</div>`

  // Fetch existing store_info
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'store_info')
    .single()

  if (data) {
    storeInfo = data.value || {}
  } else {
    storeInfo = {
      name_ar: 'أسواق الخير',
      name_en: 'Aswaq Al Kheir',
      phone: '',
      logo_url: '',
      facebook_url: 'https://www.facebook.com/AswaqALkhayrObourCity',
      instagram_url: '',
      whatsapp: '',
      tiktok_url: '',
      description_ar: 'مع أسواق الخير أنت دايماً بخير',
      description_en: 'With Aswaq Al Kheir, you are always in good hands',
      slogan_ar: 'مع أسواق الخير أنت دايماً بخير',
      slogan_en: 'Fresh quality, always.',
      hero_image_url: ''
    }
  }

  // Fetch free delivery settings
  const { data: fdData } = await supabase.from('app_settings').select('value').eq('key', 'free_delivery').single()
  if (fdData) {
    storeInfo.free_delivery_active = fdData.value?.active ?? false
    storeInfo.free_delivery_threshold = fdData.value?.threshold ?? 0
  }

  // Fetch global discount
  const { data: gdData } = await supabase.from('app_settings').select('value').eq('key', 'global_discount').single()
  if (gdData) {
    storeInfo.global_discount_active = gdData.value?.active ?? false
    storeInfo.global_discount_percent = gdData.value?.percent ?? 0
    storeInfo.global_discount_max_amount = gdData.value?.max_amount ?? null
  }

  renderSettings(container)
}

function renderSettings(container) {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]
  const s = storeInfo

  container.innerHTML = `
    <div style="max-width: 800px; margin: 0 auto;">
      <!-- Store Information -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.1rem; font-weight: 800; margin-bottom: 1.5rem; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
          🏪 ${t.store_info_section}
        </h3>
        <div class="form-grid">
          <div class="input-group">
            <label>${t.store_name_ar}</label>
            <input type="text" id="si-name-ar" value="${s.name_ar || ''}" dir="rtl">
          </div>
          <div class="input-group">
            <label>${t.store_name_en}</label>
            <input type="text" id="si-name-en" value="${s.name_en || ''}" dir="ltr">
          </div>
        </div>
        <div class="form-grid">
          <div class="input-group">
            <label>${t.store_phone}</label>
            <input type="text" id="si-phone" value="${s.phone || ''}" dir="ltr" placeholder="+20 XXX XXX XXXX">
          </div>
          <div class="input-group">
            <label>${t.store_whatsapp}</label>
            <input type="text" id="si-whatsapp" value="${s.whatsapp || ''}" dir="ltr" placeholder="+20XXXXXXXXXX">
          </div>
        </div>
        <div class="form-grid">
          <div class="input-group">
            <label>${t.store_slogan_ar}</label>
            <input type="text" id="si-slogan-ar" value="${s.slogan_ar || ''}" dir="rtl">
          </div>
          <div class="input-group">
            <label>${t.store_slogan_en}</label>
            <input type="text" id="si-slogan-en" value="${s.slogan_en || ''}" dir="ltr">
          </div>
        </div>
        <div class="input-group">
          <label>${t.store_description_ar}</label>
          <textarea id="si-desc-ar" class="form-textarea" style="min-height: 80px;" dir="rtl">${s.description_ar || ''}</textarea>
        </div>
        <div class="input-group">
          <label>${t.store_description_en}</label>
          <textarea id="si-desc-en" class="form-textarea" style="min-height: 80px;" dir="ltr">${s.description_en || ''}</textarea>
        </div>
      </div>

      <!-- Branding -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.1rem; font-weight: 800; margin-bottom: 1.5rem; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
          🎨 ${t.store_branding_section}
        </h3>
        <div class="form-grid">
          <div class="input-group">
            <label>${t.upload_logo}</label>
            <div style="display: flex; align-items: center; gap: 1rem;">
              ${s.logo_url ? `<img src="${s.logo_url}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary);">` : '<div style="width: 60px; height: 60px; border-radius: 50%; background: var(--bg-main); border: 2px dashed var(--border); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">🖼️</div>'}
              <input type="file" id="si-logo-file" accept="image/*" class="file-input">
            </div>
          </div>
          <div class="input-group">
            <label>${t.upload_hero}</label>
            <div style="display: flex; align-items: center; gap: 1rem;">
              ${s.hero_image_url ? `<img src="${s.hero_image_url}" style="width: 120px; height: 60px; border-radius: 8px; object-fit: cover; border: 1px solid var(--border);">` : '<div style="width: 120px; height: 60px; border-radius: 8px; background: var(--bg-main); border: 2px dashed var(--border); display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">🖼️</div>'}
              <input type="file" id="si-hero-file" accept="image/*" class="file-input">
            </div>
          </div>
        </div>
      </div>

      <!-- Social Media -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.1rem; font-weight: 800; margin-bottom: 1.5rem; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
          📱 ${t.store_social_section}
        </h3>
        <div class="form-grid">
          <div class="input-group">
            <label>📘 ${t.store_facebook}</label>
            <input type="url" id="si-facebook" value="${s.facebook_url || ''}" dir="ltr" placeholder="https://www.facebook.com/...">
          </div>
          <div class="input-group">
            <label>📸 ${t.store_instagram}</label>
            <input type="url" id="si-instagram" value="${s.instagram_url || ''}" dir="ltr" placeholder="https://www.instagram.com/...">
          </div>
        </div>
        <div class="input-group">
          <label>🎵 ${t.store_tiktok}</label>
          <input type="url" id="si-tiktok" value="${s.tiktok_url || ''}" dir="ltr" placeholder="https://www.tiktok.com/@...">
        </div>
      </div>

      <!-- App Theme & Design -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.1rem; font-weight: 800; margin-bottom: 1.5rem; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
          ✨ ${lang === 'ar' ? 'تصميم التطبيق' : 'App Design Theme'}
        </h3>
        <div class="input-group">
          <label>${lang === 'ar' ? 'اختر قالب التصميم' : 'Select Design Template'}</label>
          <select id="si-app-theme" style="padding: 0.75rem; font-size: 1.1rem;">
            <option value="light" ${s.app_theme === 'light' ? 'selected' : ''}>🟢 الأسواق (الافتراضي الأخضر)</option>
            <option value="dark" ${s.app_theme === 'dark' ? 'selected' : ''}>🌙 الوضع الداكن الاحترافي</option>
            <option value="blue" ${s.app_theme === 'blue' ? 'selected' : ''}>🔵 الأزرق الاحترافي</option>
          </select>
        </div>
      </div>

      <!-- Free Delivery Settings -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.1rem; font-weight: 800; margin-bottom: 1.5rem; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
          🚚 ${lang === 'ar' ? 'التوصيل المجاني' : 'Free Delivery'}
        </h3>
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
          <input type="checkbox" id="si-free-delivery-active" ${s.free_delivery_active ? 'checked' : ''} style="width: 20px; height: 20px;">
          <label for="si-free-delivery-active" style="font-weight: 700; margin: 0;">${lang === 'ar' ? 'تفعيل التوصيل المجاني' : 'Enable Free Delivery'}</label>
        </div>
        <div class="input-group">
          <label>${lang === 'ar' ? 'الحد الأدنى للطلب (ج.م)' : 'Minimum Order Amount (EGP)'}</label>
          <input type="number" id="si-free-delivery-threshold" value="${s.free_delivery_threshold || 0}" step="0.01">
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
            ${lang === 'ar' ? 'إذا تجاوز الطلب هذا المبلغ، يصبح التوصيل مجانياً.' : 'Orders above this amount will have free delivery.'}
          </p>
        </div>
      </div>

      <!-- Global Discounts -->
      <div class="card" style="margin-bottom: 1.5rem; background: #fffbeb; border: 1px solid #fde68a;">
        <h3 style="font-size: 1.1rem; font-weight: 800; margin-bottom: 1.5rem; color: #d97706; display: flex; align-items: center; gap: 0.5rem;">
          🏷️ ${lang === 'ar' ? 'خصم عام على جميع المنتجات' : 'Global Discount'}
        </h3>
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
          <input type="checkbox" id="si-global-discount-active" ${s.global_discount_active ? 'checked' : ''} style="width: 20px; height: 20px;">
          <label for="si-global-discount-active" style="font-weight: 700; margin: 0; color: #d97706;">
            ${lang === 'ar' ? 'تفعيل الخصم العام' : 'Enable Global Discount'}
          </label>
        </div>
        <div class="form-grid">
          <div class="input-group">
            <label style="color: #d97706;">${lang === 'ar' ? 'نسبة الخصم (%)' : 'Discount Percentage (%)'}</label>
            <input type="number" id="si-global-discount-percent" value="${s.global_discount_percent || 0}" min="0" max="100" step="0.1" style="border-color: #fde68a;">
          </div>
          <div class="input-group">
            <label style="color: #d97706;">${lang === 'ar' ? 'الحد الأقصى للخصم (اختياري)' : 'Max Discount Amount (Optional)'}</label>
            <input type="number" id="si-global-discount-max" value="${s.global_discount_max_amount || ''}" step="0.01" style="border-color: #fde68a;">
          </div>
        </div>
        <p style="font-size: 0.85rem; color: #b45309; margin-top: 8px; font-weight: 600;">
          ⚠️ ${lang === 'ar' 
            ? 'تنبيه: سيتم تطبيق هذا الخصم على جميع المنتجات في جميع الفروع بشكل تراكمي مع الخصومات الحالية.' 
            : 'Warning: This discount will be applied cumulatively to all products across all branches.'}
        </p>
      </div>

      <!-- Save Button -->
      <div style="display: flex; justify-content: flex-end; gap: 1rem; align-items: center;">
        <span id="si-status" class="status-message"></span>
        <button id="si-save-btn" class="btn-primary" style="min-width: 180px; font-size: 1.2rem;">
          💾 ${t.save}
        </button>
      </div>
    </div>
  `

  // Upload logo
  document.getElementById('si-logo-file').addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const fileName = `store-logo-${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('product-images').upload(fileName, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName)
      storeInfo.logo_url = publicUrl
      renderSettings(container)
    } else {
      await Dialog.alert('Upload failed: ' + error.message)
    }
  })

  // Upload hero
  document.getElementById('si-hero-file').addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const fileName = `store-hero-${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('product-images').upload(fileName, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName)
      storeInfo.hero_image_url = publicUrl
      renderSettings(container)
    } else {
      await Dialog.alert('Upload failed: ' + error.message)
    }
  })

  // Save
  document.getElementById('si-save-btn').addEventListener('click', async () => {
    const btn = document.getElementById('si-save-btn')
    const status = document.getElementById('si-status')
    btn.disabled = true
    btn.textContent = t.saving

    const payload = {
      name_ar: document.getElementById('si-name-ar').value.trim(),
      name_en: document.getElementById('si-name-en').value.trim(),
      phone: document.getElementById('si-phone').value.trim(),
      whatsapp: document.getElementById('si-whatsapp').value.trim(),
      slogan_ar: document.getElementById('si-slogan-ar').value.trim(),
      slogan_en: document.getElementById('si-slogan-en').value.trim(),
      description_ar: document.getElementById('si-desc-ar').value.trim(),
      description_en: document.getElementById('si-desc-en').value.trim(),
      facebook_url: document.getElementById('si-facebook').value.trim(),
      instagram_url: document.getElementById('si-instagram').value.trim(),
      tiktok_url: document.getElementById('si-tiktok').value.trim(),
      logo_url: storeInfo.logo_url || '',
      hero_image_url: storeInfo.hero_image_url || '',
      app_theme: document.getElementById('si-app-theme').value
    }

    const freeDeliveryPayload = {
      active: document.getElementById('si-free-delivery-active').checked,
      threshold: parseFloat(document.getElementById('si-free-delivery-threshold').value) || 0
    }

    const globalDiscountPayload = {
      active: document.getElementById('si-global-discount-active').checked,
      percent: parseFloat(document.getElementById('si-global-discount-percent').value) || 0,
      max_amount: document.getElementById('si-global-discount-max').value ? parseFloat(document.getElementById('si-global-discount-max').value) : null
    }

    const { error: err1 } = await supabase.from('app_settings').upsert({ key: 'store_info', value: payload }, { onConflict: 'key' })
    const { error: err2 } = await supabase.from('app_settings').upsert({ key: 'free_delivery', value: freeDeliveryPayload }, { onConflict: 'key' })
    const { error: err3 } = await supabase.from('app_settings').upsert({ key: 'global_discount', value: globalDiscountPayload }, { onConflict: 'key' })

    if (err1 || err2 || err3) {
      await Dialog.alert('Error: ' + (err1?.message || err2?.message || err3?.message))
    } else {
      storeInfo = payload
      status.textContent = t.store_saved_success
      status.classList.add('visible', 'success')
      
      // Apply theme immediately
      if (payload.app_theme === 'light') {
        document.documentElement.removeAttribute('data-theme')
      } else {
        document.documentElement.setAttribute('data-theme', payload.app_theme)
      }

      setTimeout(() => {
        status.classList.remove('visible', 'success')
        status.textContent = ''
      }, 3000)
    }

    btn.disabled = false
    btn.textContent = `💾 ${t.save}`
  })
}
