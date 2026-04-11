import { supabase } from '../lib/supabase.js'
import { getCurrentUser } from '../lib/auth.js'
import { translations } from '../lib/translations.js'

let users = []
let currentUser = null
const MASTER_PASSWORD = "superadmindo"

export async function loadUsers(container) {
  const lang = localStorage.getItem('freshmart_lang') || 'en'
  const t = translations[lang]

  // Clear header actions
  document.getElementById('header-actions').innerHTML = ''
  currentUser = await getCurrentUser()

  container.innerHTML = `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>${t.user_name}</th>
            <th>${t.user_email}</th>
            <th>${t.user_phone}</th>
            <th>${t.user_role}</th>
            <th>${t.actions}</th>
          </tr>
        </thead>
        <tbody id="users-tbody">
          <tr><td colspan="5" style="text-align: center;">${t.loading}</td></tr>
        </tbody>
      </table>
    </div>
  `

  await fetchUsers()
}

async function fetchUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    document.getElementById('users-tbody').innerHTML = `<tr><td colspan="5" class="error-text">Failed to load users</td></tr>`
    return
  }

  users = data || []
  renderUsers()
}

function renderUsers() {
  const lang = localStorage.getItem('freshmart_lang') || 'en'
  const t = translations[lang]
  const tbody = document.getElementById('users-tbody')

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No users found.</td></tr>`
    return
  }

  tbody.innerHTML = users.map(u => `
    <tr>
      <td style="font-weight: 700;">${u.full_name || '—'}</td>
      <td style="color: var(--text-muted); font-size: 0.8125rem;">${u.email || '—'}</td>
      <td style="font-family: monospace;">${u.phone || '—'}</td>
      <td>
        <span class="status-badge ${u.is_admin ? 'role-admin' : 'role-customer'}">
          ${u.is_admin ? t.admin : t.customer}
        </span>
      </td>
      <td>
        <div class="action-row">
          <button class="btn-secondary toggle-admin-btn" data-id="${u.id}" data-admin="${u.is_admin}" ${u.id === currentUser?.id ? 'disabled title="You cannot change your own role"' : ''}>
            ${u.is_admin ? t.revoke_admin : t.grant_admin}
          </button>
          <button class="btn-secondary edit-user-btn" data-id="${u.id}">${t.edit}</button>
          <button class="btn-secondary delete-user-btn" data-id="${u.id}" style="color: var(--error);">${t.delete}</button>
        </div>
      </td>
    </tr>
  `).join('')

  tbody.querySelectorAll('.toggle-admin-btn').forEach(btn => {
    if (btn.disabled) return;
    btn.addEventListener('click', async (e) => {
      const id = btn.dataset.id
      const newStatus = btn.dataset.admin === 'false'
      
      const confirmAction = confirm(t.grant_admin + '?');
      if (!confirmAction) return;

      btn.style.opacity = '0.5'
      
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: newStatus })
        .eq('id', id)

      if (error) {
        alert('Failed')
        btn.style.opacity = '1'
      } else {
        await fetchUsers()
      }
    })
  })

  tbody.querySelectorAll('.edit-user-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pass = prompt("Enter Master Password (superadmindo) to edit user:")
      if (pass === MASTER_PASSWORD) {
        const user = users.find(u => u.id === btn.dataset.id)
        openEditUserModal(user)
      } else {
        alert("Incorrect Master Password!")
      }
    })
  })

  tbody.querySelectorAll('.delete-user-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id
      const pass = prompt("Enter Master Password (superadmindo) to DELETE user:")
      if (pass === MASTER_PASSWORD) {
        if (confirm("Are you sure? This cannot be undone.")) {
          // In Supabase, deleting from profiles is easy, but auth user requires admin API
          // For demo purposes, we delete the profile
          const { error } = await supabase.from('profiles').delete().eq('id', id)
          if (!error) {
            await fetchUsers()
          } else {
            alert("Error: " + error.message)
          }
        }
      } else {
        alert("Incorrect Master Password!")
      }
    })
  })
}

function openEditUserModal(user) {
  const lang = localStorage.getItem('freshmart_lang') || 'en'
  const t = translations[lang]

  const modalHtml = `
    <div class="modal-overlay" id="user-modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>${t.edit} ${t.users}</h3>
          <button id="close-user-modal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="edit-user-form">
            <div class="input-group">
              <label>${t.user_name}</label>
              <input type="text" name="full_name" value="${user.full_name || ''}" required>
            </div>
            <div class="input-group">
              <label>${t.user_phone}</label>
              <input type="text" name="phone" value="${user.phone || ''}">
            </div>
            <div class="input-group">
              <label>${t.password} (New)</label>
              <input type="password" name="new_password" placeholder="Leave blank to keep current">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button id="cancel-user-modal" class="btn-secondary">${t.cancel}</button>
          <button form="edit-user-form" class="btn-primary" style="width: auto;">${t.save}</button>
        </div>
      </div>
    </div>
  `

  document.body.insertAdjacentHTML('beforeend', modalHtml)
  
  const close = () => document.getElementById('user-modal-overlay').remove()
  document.getElementById('close-user-modal').addEventListener('click', close)
  document.getElementById('cancel-user-modal').addEventListener('click', close)

  document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const btn = e.target.querySelector('button[type="submit"]')
    const newPass = formData.get('new_password')

    const updateData = {
      full_name: formData.get('full_name'),
      phone: formData.get('phone'),
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase.from('profiles').update(updateData).eq('id', user.id)

    if (error) {
      alert("Error: " + error.message)
    } else {
      if (newPass) {
        alert("Note: Password update simulated for demo. Real password updates for other users require Admin API permissions on the server.")
      }
      close()
      await fetchUsers()
    }
  })
}
