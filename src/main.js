import { getCurrentUser, login, logout } from './lib/auth.js'
import { loadInventory } from './pages/inventory.js'
import { loadOrders } from './pages/orders.js'
import { loadUsers } from './pages/users.js'
import { loadMarketing } from './pages/marketing.js'
import { translations } from './lib/translations.js'

let currentLang = localStorage.getItem('freshmart_lang') || 'en'

const loginContainer = document.getElementById('login-container')
const dashboardContainer = document.getElementById('dashboard-container')
const loginForm = document.getElementById('login-form')
const authError = document.getElementById('auth-error')
const pageTitle = document.getElementById('page-title')
const pageContent = document.getElementById('page-content')
const logoutBtn = document.getElementById('logout-btn')
const navItems = document.querySelectorAll('.nav-item[data-page]')
const langToggle = document.getElementById('lang-toggle')
const langText = document.getElementById('lang-text')

// Router mapping
const routes = {
  inventory: { title: 'Product Inventory', loader: loadInventory },
  orders: { title: 'Order Management', loader: loadOrders },
  users: { title: 'User Management', loader: loadUsers },
  marketing: { title: 'App Marketing', loader: loadMarketing }
}

async function init() {
  applyLanguage()
  const user = await getCurrentUser()
  
  if (user) {
    showDashboard()
    navigateTo('inventory')
  } else {
    showLogin()
  }
}

function applyLanguage() {
  document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr'
  langText.textContent = currentLang === 'ar' ? 'English' : 'العربية'
  
  // Update static elements
  const t = translations[currentLang]
  document.querySelector('.login-card h1').textContent = t.login_title
  document.querySelector('.login-card p').textContent = t.login_subtitle
  document.querySelector('label[for="email"]').textContent = t.email
  document.querySelector('label[for="password"]').textContent = t.password
  document.querySelector('.login-card button').textContent = t.sign_in
  
  document.querySelector('.nav-item[data-page="inventory"]').childNodes[2].textContent = ' ' + t.inventory
  document.querySelector('.nav-item[data-page="orders"]').childNodes[2].textContent = ' ' + t.orders
  document.querySelector('.nav-item[data-page="users"]').childNodes[2].textContent = ' ' + t.users
  document.querySelector('.nav-item[data-page="marketing"]').childNodes[2].textContent = ' ' + t.marketing
  document.querySelector('#logout-btn').childNodes[2].textContent = ' ' + t.logout
}

function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'ar' : 'en'
  localStorage.setItem('freshmart_lang', currentLang)
  applyLanguage()
  
  // Reload current page to refresh translations
  const activeNav = document.querySelector('.nav-item.active')
  if (activeNav) {
    navigateTo(activeNav.dataset.page)
  }
}

function showLogin() {
  loginContainer.classList.remove('hidden')
  dashboardContainer.classList.add('hidden')
}

function showDashboard() {
  loginContainer.classList.add('hidden')
  dashboardContainer.classList.remove('hidden')
}

async function navigateTo(pageId) {
  const route = routes[pageId]
  if (!route) return

  // Update UI
  navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageId)
  })
  pageTitle.textContent = route.title
  pageContent.innerHTML = '<div class="loader">Loading...</div>'
  
  // Load module content
  try {
    await route.loader(pageContent)
  } catch (error) {
    pageContent.innerHTML = `<div class="error-card">Error loading page: ${error.message}</div>`
  }
}

// Event Listeners
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  authError.textContent = ''
  const email = e.target.email.value
  const password = e.target.password.value
  
  try {
    await login(email, password)
    showDashboard()
    navigateTo('inventory')
  } catch (error) {
    authError.textContent = error.message
  }
})

logoutBtn.addEventListener('click', logout)

navItems.forEach(item => {
  item.addEventListener('click', () => navigateTo(item.dataset.page))
})

langToggle.addEventListener('click', toggleLanguage)

init()
