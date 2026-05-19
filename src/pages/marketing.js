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
      fg_image: ''
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

  listContainer.innerHTML = banners.map((b, i) => `
    <div class="card banner-edit-card" data-index="${i}">
      <div style="display: flex; gap: 1.5rem; flex-direction: column;">
        <div style="display: flex; gap: 1rem; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 1rem;">
           <div class="banner-preview-mini" style="background: ${b.color}; width: 60px; height: 60px; font-size: 1.5rem;">
            <span>${b.emoji}</span>
           </div>
           <div style="flex: 1;">
             <input type="text" value="${b.title}" oninput="updateBanner(${i}, 'title', this.value)" style="font-weight: 800; font-size: 1.1rem; border: none; background: transparent; width: 100%;">
             <input type="text" value="${b.subtitle}" oninput="updateBanner(${i}, 'subtitle', this.value)" style="color: var(--text-muted); font-size: 0.875rem; border: none; background: transparent; width: 100%;">
           </div>
           <button class="btn-icon" onclick="removeBanner(${i})">🗑️</button>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
           <div class="input-group">
            <label>${t.emoji}</label>
            <input type="text" value="${b.emoji}" oninput="updateBanner(${i}, 'emoji', this.value)">
          </div>
          <div class="input-group">
            <label>${t.bg_color}</label>
            <input type="color" value="${b.color}" oninput="updateBanner(${i}, 'color', this.value)" style="height: 48px; cursor: pointer; padding: 2px;">
          </div>
        </div>
        <div class="banner-image-grid">
          <div class="input-group">
            <label>${t.bg_image}</label>
            <div class="banner-img-preview-container">
              ${b.bg_image ? `<img src="${b.bg_image}" class="banner-img-preview">` : `<div class="banner-img-preview"></div>`}
              <input type="file" onchange="uploadBannerImg(${i}, 'bg_image', this)" style="font-size: 0.7rem; width: 100%;">
            </div>
          </div>
          <div class="input-group">
            <label>${t.item_image}</label>
            <div class="banner-img-preview-container">
              ${b.item_image ? `<img src="${b.item_image}" class="banner-img-preview">` : `<div class="banner-img-preview"></div>`}
              <input type="file" onchange="uploadBannerImg(${i}, 'item_image', this)" style="font-size: 0.7rem; width: 100%;">
            </div>
          </div>
          <div class="input-group">
            <label>${t.fg_image}</label>
            <div class="banner-img-preview-container">
              ${b.fg_image ? `<img src="${b.fg_image}" class="banner-img-preview">` : `<div class="banner-img-preview"></div>`}
              <input type="file" onchange="uploadBannerImg(${i}, 'fg_image', this)" style="font-size: 0.7rem; width: 100%;">
            </div>
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end;">
           <button class="btn-primary" onclick="saveAllBanners()" style="width: auto;">${t.save_all}</button>
        </div>
      </div>
    </div>
  `).join('')

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
  phoneContent.innerHTML = banners.map(b => `
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
  `).join('')
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
