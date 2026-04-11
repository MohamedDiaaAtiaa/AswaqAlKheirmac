import { supabase } from '../lib/supabase.js'
import { translations } from '../lib/translations.js'

let orders = []
let subscription = null
let refreshInterval = null

export async function loadOrders(container) {
  const lang = localStorage.getItem('freshmart_lang') || 'en'
  const t = translations[lang]

  // Setup header
  const headerActions = document.getElementById('header-actions')
  headerActions.innerHTML = `
    <button class="btn-secondary" disabled>
      <span style="display:inline-block; width:8px; height:8px; background:var(--success); border-radius:50%; margin-right:4px;"></span>
      Live Sync Active
    </button>
  `

  container.innerHTML = `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>${t.order_id}</th>
            <th>${t.date}</th>
            <th>${t.items}</th>
            <th>${t.total}</th>
            <th>${t.priority || 'Rank'}</th>
            <th>${t.status}</th>
            <th>${t.actions}</th>
          </tr>
        </thead>
        <tbody id="orders-tbody">
          <tr><td colspan="7" style="text-align: center;">${t.loading}</td></tr>
        </tbody>
      </table>
    </div>
  `

  await fetchOrders()
  subscribeToOrders()
  
  if (refreshInterval) clearInterval(refreshInterval)
  refreshInterval = setInterval(renderOrders, 1000) // Update time since order every second
}

async function fetchOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    document.getElementById('orders-tbody').innerHTML = `<tr><td colspan="7" class="error-text">Failed to load orders</td></tr>`
    return
  }

  orders = data || []
  renderOrders()
}

function calculatePriority(order) {
  // Delivered or Cancelled orders have no priority
  if (order.status === 'Delivered' || order.status === 'Cancelled') return 0

  const now = new Date()
  const createdAt = new Date(order.created_at)
  const timeSinceSeconds = (now - createdAt) / 1000
  const itemCount = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0
  
  // Priority formula: more ordered items x time since ordered / 2
  return (itemCount * timeSinceSeconds) / 2
}

function renderOrders() {
  const tbody = document.getElementById('orders-tbody')
  if (!tbody) return

  const lang = localStorage.getItem('freshmart_lang') || 'en'
  const t = translations[lang]

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No incoming orders yet.</td></tr>`
    return
  }

  // Sort orders by priority (highest first)
  const sortedOrders = [...orders].sort((a, b) => calculatePriority(b) - calculatePriority(a))

  tbody.innerHTML = sortedOrders.map(o => {
    const total = o.order_items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0
    const itemCount = o.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0
    
    // Exact date and time including seconds
    const dateObj = new Date(o.created_at)
    const dateStr = dateObj.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
    
    const now = new Date()
    const diffSeconds = Math.floor((now - dateObj) / 1000)
    const priority = calculatePriority(o)
    
    // Highlight if old (e.g., more than 5 minutes / 300 seconds)
    const isOld = diffSeconds > 300 && o.status === 'Pending'
    const priorityClass = isOld ? 'order-priority-high' : ''

    return `
      <tr class="${priorityClass}">
        <td style="font-family: monospace; font-size: 0.75rem; color: var(--text-muted);">${o.id.split('-')[0]}...</td>
        <td>
          <div>${dateStr}</div>
          <div style="font-size: 0.7rem; opacity: 0.8;">${diffSeconds}s ago</div>
        </td>
        <td>${itemCount} item(s)</td>
        <td style="font-weight: 600;">€${total.toFixed(2)}</td>
        <td>
          <span class="priority-badge">${priority.toFixed(1)}</span>
        </td>
        <td>
          <span class="status-badge" style="${o.status === 'Pending' ? 'background: #fef08a; color: #854d0e;' : ''}">${o.status}</span>
        </td>
        <td>
          <div class="action-row">
            <button class="btn-secondary view-btn" data-id="${o.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">${t.view}</button>
            <button class="btn-secondary edit-btn" data-id="${o.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" ${o.status === 'Out for Delivery' || o.status === 'Delivered' ? 'disabled' : ''}>${t.edit}</button>
            <button class="btn-secondary delete-btn" data-id="${o.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: var(--error);">${t.delete}</button>
          </div>
        </td>
      </tr>
    `
  }).join('')

  tbody.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const order = orders.find(o => o.id === btn.dataset.id)
      openOrderModal(order)
    })
  })

  tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const order = orders.find(o => o.id === btn.dataset.id)
      openEditOrderModal(order)
    })
  })

  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id
      if (confirm(t.delete_order + '?')) {
        const { error } = await supabase.from('orders').delete().eq('id', id)
        if (!error) {
          orders = orders.filter(o => o.id !== id)
          renderOrders()
        } else {
          alert('Delete failed: ' + error.message)
        }
      }
    })
  })
}

function openOrderModal(order) {
  const lang = localStorage.getItem('freshmart_lang') || 'en'
  const t = translations[lang]
  const total = order.order_items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0
  
  const itemsHtml = order.order_items?.map(item => `
    <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--border);">
      <div>
        <div style="font-weight: 500;">${item.product_name}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">Qty: ${item.quantity}</div>
      </div>
      <div style="font-weight: 600;">€${(item.price * item.quantity).toFixed(2)}</div>
    </div>
  `).join('') || '<p>No items recorded.</p>'

  const modalHtml = `
    <div class="modal-overlay" id="order-modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3 style="font-size: 1.25rem; font-weight: 700;">${t.order_id}</h3>
          <button id="close-order-modal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">${t.order_id}</div>
              <div style="font-family: monospace; font-size: 0.85rem;">${order.id}</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">${t.date}</div>
              <div style="font-size: 0.85rem;">${new Date(order.created_at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}</div>
            </div>
          </div>
          
          <div style="margin-bottom: 1.5rem;">
            <h4 style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.25rem;">${t.items}</h4>
            ${itemsHtml}
            <div style="display: flex; justify-content: space-between; padding-top: 1rem; font-weight: 700; font-size: 1.1rem;">
              <span>${t.total}</span>
              <span>€${total.toFixed(2)}</span>
            </div>
          </div>

          <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 2px dashed var(--border);">
            <label style="display: block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.75rem; color: var(--text-muted);">${t.status}</label>
            <div style="display: flex; gap: 0.75rem;">
              <select id="update-status-select" class="btn-secondary" style="flex: 1; padding: 0.5rem;">
                <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>⏳ Pending</option>
                <option value="Preparing" ${order.status === 'Preparing' ? 'selected' : ''}>👨‍🍳 Preparing</option>
                <option value="Out for Delivery" ${order.status === 'Out for Delivery' ? 'selected' : ''}>🛵 Out for Delivery</option>
                <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>✅ Delivered</option>
                <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>❌ Cancelled</option>
              </select>
              <button id="save-status-btn" class="btn-primary" style="width: auto;">${t.save}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `

  document.body.insertAdjacentHTML('beforeend', modalHtml)
  const overlay = document.getElementById('order-modal-overlay')
  
  document.getElementById('close-order-modal').addEventListener('click', () => {
    overlay.remove()
  })

  document.getElementById('save-status-btn').addEventListener('click', async () => {
    const newStatus = document.getElementById('update-status-select').value
    const btn = document.getElementById('save-status-btn')
    btn.disabled = true
    btn.textContent = t.loading

    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', order.id)

    if (error) {
      alert('Failed: ' + error.message)
      btn.disabled = false
      btn.textContent = t.save
    } else {
      overlay.remove()
      fetchOrders()
    }
  })
}

function openEditOrderModal(order) {
  const lang = localStorage.getItem('freshmart_lang') || 'en'
  const t = translations[lang]
  
  let currentItems = [...order.order_items]

  const renderEditItems = () => {
    const container = document.getElementById('edit-items-container')
    container.innerHTML = currentItems.map((item, idx) => `
      <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);">
        <div style="flex: 1;">
          <div style="font-weight: 600;">${item.product_name}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">€${item.price} / unit</div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <button type="button" class="btn-secondary" style="min-height: 32px; padding: 0 0.5rem;" onclick="updateItemQty(${idx}, -1)">-</button>
          <span style="min-width: 30px; text-align: center; font-weight: 700;">${item.quantity}</span>
          <button type="button" class="btn-secondary" style="min-height: 32px; padding: 0 0.5rem;" onclick="updateItemQty(${idx}, 1)">+</button>
        </div>
        <button type="button" class="btn-icon" onclick="removeItem(${idx})">🗑️</button>
      </div>
    `).join('')
  }

  window.updateItemQty = (idx, delta) => {
    currentItems[idx].quantity = Math.max(1, currentItems[idx].quantity + delta)
    renderEditItems()
  }

  window.removeItem = (idx) => {
    currentItems.splice(idx, 1)
    renderEditItems()
  }

  const modalHtml = `
    <div class="modal-overlay" id="edit-order-modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>${t.edit_order}</h3>
          <button id="close-edit-modal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div id="edit-items-container"></div>
        </div>
        <div class="modal-footer">
          <button id="cancel-edit-btn" class="btn-secondary">${t.cancel}</button>
          <button id="save-edit-btn" class="btn-primary" style="width: auto;">${t.save}</button>
        </div>
      </div>
    </div>
  `

  document.body.insertAdjacentHTML('beforeend', modalHtml)
  renderEditItems()

  document.getElementById('close-edit-modal').addEventListener('click', () => {
    document.getElementById('edit-order-modal-overlay').remove()
  })
  document.getElementById('cancel-edit-btn').addEventListener('click', () => {
    document.getElementById('edit-order-modal-overlay').remove()
  })

  document.getElementById('save-edit-btn').addEventListener('click', async () => {
    const btn = document.getElementById('save-edit-btn')
    btn.disabled = true
    btn.textContent = t.loading

    // This is a complex update since we need to update order_items
    // For simplicity in a demo, we delete old items and insert new ones
    
    // First update the order's updated_at
    await supabase.from('orders').update({ updated_at: new Date().toISOString() }).eq('id', order.id)

    // Delete existing items
    await supabase.from('order_items').delete().eq('order_id', order.id)

    // Insert new items
    const newItems = currentItems.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      price: item.price
    }))

    const { error } = await supabase.from('order_items').insert(newItems)

    if (error) {
      alert('Save failed: ' + error.message)
      btn.disabled = false
      btn.textContent = t.save
    } else {
      document.getElementById('edit-order-modal-overlay').remove()
      fetchOrders()
    }
  })
}

function subscribeToOrders() {
  if (subscription) return
  
  subscription = supabase
    .channel('public:orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
      fetchOrders()
    })
    .subscribe()
}

export function cleanupOrders() {
  if (subscription) supabase.removeChannel(subscription)
  subscription = null
  if (refreshInterval) clearInterval(refreshInterval)
}
