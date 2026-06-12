import { supabase } from '../lib/supabase.js'
import { translations } from '../lib/translations.js'
import { Dialog } from '../lib/dialog.js'
let banners = []

export async function loadMarketing(container) {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]

  document.getElementById('header-actions').innerHTML = `
    <button id="add-banner-btn" class="btn-primary">
      <span>+</span> ${t.add_banner}
    </button>
  `

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 340px; gap: 2rem; align-items: start;">
      <div id="banners-list" style="display: flex; flex-direction: column; gap: 1rem;">
        <div class="card"><div class="loader">${t.loading}</div></div>
      </div>
      <div class="sidebar-preview">
        <div class="card" style="position: sticky; top: 2rem; padding: 1.5rem;">
          <h4 style="margin-bottom: 1rem; font-size: 0.875rem; color: var(--text-muted); text-transform: uppercase;">${t.preview}</h4>
          <div class="phone-frame">
            <div id="phone-content" class="phone-content"></div>
          </div>
        </div>
      </div>
    </div>
  `

  await fetchBanners()
  
  document.getElementById('add-banner-btn').addEventListener('click', () => {
    banners.push({
      id: Date.now().toString(),
      title: t.new_promotion,
      subtitle: t.click_to_edit,
      emoji: '✨',
      color: '#E5F7FF',
      bg_image: '',
      item_image: '',
      fg_image: '',
      design_type: 'standard',
      plain_image: ''
    })
    renderBanners()
  })
}

async function fetchBanners() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'banners')
    .single()

  if (error && error.code !== 'PGRST116') {
    document.getElementById('banners-list').innerHTML = `<div class="card error-text">Error: ${error.message}</div>`
    return
  }

  banners = data?.value || []
  renderBanners()
}

function renderBanners() {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]
  const listContainer = document.getElementById('banners-list')
  const phoneContent = document.getElementById('phone-content')

  if (banners.length === 0) {
    listContainer.innerHTML = `<div class="card" style="text-align: center; color: var(--text-muted);">${t.no_banners}</div>`
    phoneContent.innerHTML = `<div style="padding: 2rem; text-align: center; color: #ccc;">${t.no_active_banners}</div>`
    return
  }

  listContainer.innerHTML = banners.map((b, i) => {
    const isPlain = b.design_type === 'plain'
    return `
    <div class="card banner-edit-card" data-index="${i}">
      <div style="display: flex; gap: 1.5rem; flex-direction: column;">
        <div style="display: flex; gap: 1rem; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 1rem;">
           <div class="banner-preview-mini" style="background: ${b.color}; width: 60px; height: 60px; font-size: 1.5rem; overflow: hidden; border-radius: 10px;">
            ${isPlain && b.plain_image ? `<img src="${b.plain_image}" style="width:100%;height:100%;object-fit:cover;">` : `<span>${b.emoji || '✨'}</span>`}
           </div>
           <div style="flex: 1;">
             <div style="font-weight: 800; font-size: 1.1rem;">${isPlain ? (lang === 'ar' ? '🖼️ تصميم بسيط (صورة كاملة)' : '🖼️ Plain Design (Full Image)') : (b.title || '')}</div>
             <div style="color: var(--text-muted); font-size: 0.875rem;">${isPlain ? (lang === 'ar' ? 'صورة واحدة فقط بدون نص' : 'Single image, no text') : (b.subtitle || '')}</div>
           </div>
           <button class="btn-icon" onclick="removeBanner(${i})">🗑️</button>
        </div>

        <!-- Design Type Toggle -->
        <div style="display: flex; gap: 0; border-radius: 10px; overflow: hidden; border: 1px solid var(--border); max-width: 320px;">
          <button type="button" onclick="updateBanner(${i}, 'design_type', 'standard')" style="flex:1;padding:0.6rem 1rem;border:none;cursor:pointer;font-weight:700;font-size:0.85rem;background:${!isPlain ? 'var(--primary)' : 'var(--surface-hover)'};color:${!isPlain ? 'white' : 'var(--text-secondary)'};">
            🎨 ${lang === 'ar' ? 'تصميم متكامل' : 'Standard'}
          </button>
          <button type="button" onclick="updateBanner(${i}, 'design_type', 'plain')" style="flex:1;padding:0.6rem 1rem;border:none;border-left:1px solid var(--border);cursor:pointer;font-weight:700;font-size:0.85rem;background:${isPlain ? 'var(--primary)' : 'var(--surface-hover)'};color:${isPlain ? 'white' : 'var(--text-secondary)'};">
            🖼️ ${lang === 'ar' ? 'صورة كاملة' : 'Plain Image'}
          </button>
        </div>

        ${isPlain ? `
        <!-- Plain Design: just one image -->
        <div class="input-group">
          <label style="font-weight:700;">${lang === 'ar' ? 'صورة البنر (كاملة العرض)' : 'Banner Image (Full Width)'}</label>
          <div class="banner-img-preview-container">
            ${b.plain_image ? `<img src="${b.plain_image}" style="width:100%;max-height:160px;object-fit:cover;border-radius:10px;margin-bottom:8px;">` : `<div class="banner-img-preview" style="width:100%;height:120px;"></div>`}
            <input type="file" onchange="uploadBannerImg(${i}, 'plain_image', this)" style="font-size: 0.8rem; width: 100%;" accept="image/*">
          </div>
          <p style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">${lang === 'ar' ? 'الأبعاد المقترحة: 1000×500 بكسل (2:1)' : 'Recommended: 1000×500px (2:1 ratio)'}</p>
        </div>
        ` : `
        <!-- Standard Design -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="input-group">
            <label>${t.emoji}</label>
            <input type="text" value="${b.emoji || ''}" oninput="updateBanner(${i}, 'emoji', this.value)">
          </div>
          <div class="input-group">
            <label>${t.bg_color}</label>
            <input type="color" value="${b.color || '#ea580c'}" oninput="updateBanner(${i}, 'color', this.value)" style="height: 48px; cursor: pointer; padding: 2px;">
          </div>
        </div>
        <div class="input-group">
          <label>${lang === 'ar' ? 'العنوان' : 'Title'}</label>
          <input type="text" value="${b.title || ''}" oninput="updateBanner(${i}, 'title', this.value)" style="width:100%;">
        </div>
        <div class="input-group">
          <label>${lang === 'ar' ? 'النص الفرعي' : 'Subtitle'}</label>
          <input type="text" value="${b.subtitle || ''}" oninput="updateBanner(${i}, 'subtitle', this.value)" style="width:100%;">
        </div>
        <div class="banner-image-grid">
          <div class="input-group">
            <label>${t.bg_image}</label>
            <div class="banner-img-preview-container">
              ${b.bg_image ? `<img src="${b.bg_image}" class="banner-img-preview">` : `<div class="banner-img-preview"></div>`}
              <input type="file" onchange="uploadBannerImg(${i}, 'bg_image', this)" style="font-size: 0.7rem; width: 100%;" accept="image/*">
            </div>
          </div>
          <div class="input-group">
            <label>${t.item_image}</label>
            <div class="banner-img-preview-container">
              ${b.item_image ? `<img src="${b.item_image}" class="banner-img-preview">` : `<div class="banner-img-preview"></div>`}
              <input type="file" onchange="uploadBannerImg(${i}, 'item_image', this)" style="font-size: 0.7rem; width: 100%;" accept="image/*">
            </div>
          </div>
          <div class="input-group">
            <label>${t.fg_image}</label>
            <div class="banner-img-preview-container">
              ${b.fg_image ? `<img src="${b.fg_image}" class="banner-img-preview">` : `<div class="banner-img-preview"></div>`}
              <input type="file" onchange="uploadBannerImg(${i}, 'fg_image', this)" style="font-size: 0.7rem; width: 100%;" accept="image/*">
            </div>
          </div>
        </div>
        `}

        <div style="display: flex; justify-content: flex-end;">
           <button class="btn-primary" onclick="saveAllBanners()" style="width: auto;">${t.save_all}</button>
        </div>
      </div>
    </div>
  `}).join('')

  renderPhonePreview()

  window.updateBanner = (idx, field, val) => {
    banners[idx][field] = val
    renderPhonePreview()
  }

  window.uploadBannerImg = async (idx, field, input) => {
    const file = input.files[0]
    if (!file) return
    input.disabled = true
    const fileName = `banner-${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage.from('product-images').upload(fileName, file)
    if (!error) {
       const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName)
       banners[idx][field] = publicUrl
       renderBanners()
    } else {
      await Dialog.alert('Upload failed')
      input.disabled = false
    }
  }

  window.removeBanner = async (idx) => {
    const confirmed = await Dialog.confirm(t.confirm_delete_banner)
    if (confirmed) {
      banners.splice(idx, 1)
      renderBanners()
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'banners', value: banners }, { onConflict: 'key' })
      if (error) await Dialog.alert(`Error: ${error.message}`)
    }
  }

  window.saveAllBanners = saveAllBanners
}

function renderPhonePreview() {
  const phoneContent = document.getElementById('phone-content')
  if (!phoneContent) return
  phoneContent.innerHTML = banners.map(b => {
    if (b.design_type === 'plain') {
      return `<div class="banner-mobile-card" style="background:#f1f5f9;padding:0;overflow:hidden;">
        ${b.plain_image
          ? `<img src="${b.plain_image}" style="width:100%;height:100%;object-fit:cover;display:block;">`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.8rem;">🖼️ Plain Image Banner</div>`
        }
      </div>`
    }
    return `
    <div class="banner-mobile-card" style="background: ${b.color}; overflow: hidden; position: relative;">
      ${b.bg_image ? `<img src="${b.bg_image}" style="position: absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; opacity: 0.3;">` : ''}
      <div class="banner-mobile-text" style="position: relative; z-index: 2;">
        <div class="banner-mobile-title">${b.title}</div>
        <div class="banner-mobile-subtitle">${b.subtitle}</div>
      </div>
      <div style="position: relative; z-index: 2; display: flex; align-items: center; gap: 4px;">
        ${b.item_image ? `<img src="${b.item_image}" style="width: 40px; height: 40px; border-radius: 8px;">` : `<div class="banner-mobile-emoji">${b.emoji}</div>`}
        ${b.fg_image ? `<img src="${b.fg_image}" style="width: 30px; height: 30px; position: absolute; bottom: -5px; right: -5px;">` : ''}
      </div>
    </div>
  `}).join('')
}

async function saveAllBanners() {
  const lang = localStorage.getItem('aswaq_lang') || 'ar'
  const t = translations[lang]
  let saveBtn = null;
  if (event && event.currentTarget) {
    saveBtn = event.currentTarget
    saveBtn.textContent = t.saving
    saveBtn.disabled = true
  }
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'banners', value: banners }, { onConflict: 'key' })
  if (error) await Dialog.alert(`Error: ${error.message}`)
  if (saveBtn) {
    saveBtn.textContent = t.saved
    setTimeout(() => {
      saveBtn.textContent = t.save_all
      saveBtn.disabled = false
    }, 2000)
  }
}
