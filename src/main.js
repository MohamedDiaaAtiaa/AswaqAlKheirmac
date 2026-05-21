// Auth skipped for desktop demo
import { loadInventory } from './pages/inventory.js'
import { loadOrders } from './pages/orders.js'
import { loadUsers } from './pages/users.js'
import { loadMarketing } from './pages/marketing.js'
import { loadBranches } from './pages/branches.js'
import { loadDailyTracking } from './pages/daily_tracking.js'
import { loadBranchSales } from './pages/branch_sales.js'
import { loadStoreSettings } from './pages/store_settings.js'
import { loadCategories } from './pages/categories.js'
import { translations } from './lib/translations.js'
import { supabase } from './lib/supabase.js'
import { Dialog } from './lib/dialog.js'

// Arabic is the default/primary language
let currentLang = localStorage.getItem('aswaq_lang') || 'ar'
let branches = []
let currentBranchId = localStorage.getItem('aswaq_branch_id') || ''

const dashboardContainer = document.getElementById('dashboard-container')
const pageTitle = document.getElementById('page-title')
const pageContent = document.getElementById('page-content')
const navItems = document.querySelectorAll('.nav-item[data-page]')
const langToggle = document.getElementById('lang-toggle')
const langText = document.getElementById('lang-text')
const branchSelector = document.getElementById('global-branch-selector')

// Router mapping
const routes = {
  inventory: { title: 'inventory_title', loader: loadInventory },
  orders: { title: 'orders_title', loader: (c) => loadOrders(c, currentBranchId) },
  branches: { title: 'branches_title', loader: loadBranches },
  tracking: { title: 'tracking_title', loader: loadDailyTracking, isSouq: true },
  users: { title: 'users_title', loader: loadUsers },
  marketing: { title: 'marketing_title', loader: loadMarketing },
  store_settings: { title: 'store_settings_title', loader: loadStoreSettings },
  souq_products: { title: 'main_products', loader: (c) => loadInventory(c, true), isSouq: true },
  souq_orders: { title: 'all_orders', loader: (c) => loadOrders(c, ''), isSouq: true },
  souq_sales: { title: 'bs_title', loader: (c) => loadBranchSales(c, true), isSouq: true },
  branch_sales: { title: 'bs_title', loader: (c) => loadBranchSales(c, false) },
  categories: { title: 'categories_title', loader: loadCategories }
}

async function init() {
  applyLanguage()
  await fetchBranches()
  await loadAppTheme()
  showDashboard()
  navigateTo('inventory')
  setupSouqDropdown()
}

async function loadAppTheme() {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'store_info').single()
  if (data && data.value && data.value.app_theme) {
    const theme = data.value.app_theme
    if (theme !== 'light') {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }
}

async function fetchBranches() {
  const { data, error } = await supabase.from('branches').select('id, name, name_en').eq('is_active', true)
  if (error) return
  
  branches = data || []
  renderBranchSelector()
}

function renderBranchSelector() {
  if (!branchSelector) return
  const lang = currentLang
  
  branchSelector.innerHTML = branches.map(b => `
    <option value="${b.id}" ${b.id === currentBranchId ? 'selected' : ''}>
      ${lang === 'ar' ? b.name : (b.name_en || b.name)}
    </option>
  `).join('')
  
  if (!currentBranchId && branches.length > 0) {
    currentBranchId = branches[0].id
    localStorage.setItem('aswaq_branch_id', currentBranchId)
    renderBranchSelector()
  }

  branchSelector.addEventListener('change', (e) => {
    currentBranchId = e.target.value
    localStorage.setItem('aswaq_branch_id', currentBranchId)
    // Refresh current page if it's branch-dependent
    const activeNav = document.querySelector('.nav-item.active')
    if (activeNav && !routes[activeNav.dataset.page].isSouq) {
      navigateTo(activeNav.dataset.page)
    }
  })
}

function setupSouqDropdown() {
  const trigger = document.getElementById('souq-trigger')
  const menu = document.getElementById('souq-menu')
  if (!trigger || !menu) return

  trigger.addEventListener('click', () => {
    menu.classList.toggle('hidden')
    trigger.classList.toggle('active')
  })
}

function applyLanguage() {
  document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.lang = currentLang === 'ar' ? 'ar' : 'en'
  langText.textContent = currentLang === 'ar' ? 'English' : 'العربية'
  
  const t = translations[currentLang]
  
  // Update all elements with data-t attribute
  document.querySelectorAll('[data-t]').forEach(el => {
    const key = el.dataset.t
    if (t[key]) el.textContent = t[key]
  })
}

function toggleLanguage() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar'
  localStorage.setItem('aswaq_lang', currentLang)
  applyLanguage()
  renderBranchSelector()
  
  const activeNav = document.querySelector('.nav-item.active')
  if (activeNav) navigateTo(activeNav.dataset.page)
}

function showDashboard() {
  dashboardContainer.classList.remove('hidden')
}

async function navigateTo(pageId) {
  const route = routes[pageId]
  if (!route) return

  const t = translations[currentLang]

  // Password protection for Souq pages
  if (route.isSouq) {
    const password = await Dialog.prompt(t.souq_password_hint, '', 'password')
    if (password !== 'superadmindo') {
      if (password !== null) await Dialog.alert(t.incorrect_password)
      return
    }
  }

  // Update UI
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageId)
  })
  
  pageTitle.textContent = t[route.title] || route.title
  pageContent.innerHTML = `<div class="loader">${t.loading}</div>`
  
  try {
    await route.loader(pageContent)
  } catch (error) {
    pageContent.innerHTML = `<div class="error-card">Error: ${error.message}</div>`
  }
}

// Event Listeners
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  item.addEventListener('click', () => navigateTo(item.dataset.page))
})

langToggle.addEventListener('click', toggleLanguage)

init()
