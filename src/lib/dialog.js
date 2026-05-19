export const Dialog = {
  _createModal(html, wrapperId) {
    document.body.insertAdjacentHTML('beforeend', html);
    const modal = document.getElementById(wrapperId);
    return modal;
  },
  
  _closeModal(wrapperId) {
    const modal = document.getElementById(wrapperId);
    if (modal) {
      modal.remove();
    }
  },

  alert(message, title = 'Notification') {
    return new Promise(resolve => {
      const id = 'dialog-alert-' + Math.random().toString(36).substr(2, 9);
      const html = `
        <div class="modal-overlay" id="${id}" style="z-index: 9999;">
          <div class="modal" style="max-width: 400px; text-align: center;">
            <div class="modal-header" style="justify-content: center; border-bottom: none; padding-bottom: 0;">
              <h3>${title}</h3>
            </div>
            <div class="modal-body" style="padding: 1.5rem 2rem;">
              <p style="color: var(--text-article); margin-bottom: 1.5rem;">${message}</p>
              <button id="${id}-btn" class="btn-primary" style="width: 100%;">OK</button>
            </div>
          </div>
        </div>
      `;
      this._createModal(html, id);
      
      const btn = document.getElementById(`${id}-btn`);
      btn.focus();
      btn.addEventListener('click', () => {
        this._closeModal(id);
        resolve();
      });
    });
  },

  confirm(message, title = 'Confirm') {
    return new Promise(resolve => {
      const id = 'dialog-confirm-' + Math.random().toString(36).substr(2, 9);
      const html = `
        <div class="modal-overlay" id="${id}" style="z-index: 9999;">
          <div class="modal" style="max-width: 400px;">
            <div class="modal-header" style="border-bottom: none; padding-bottom: 0;">
              <h3>${title}</h3>
            </div>
            <div class="modal-body" style="padding: 1.5rem 2rem;">
              <p style="color: var(--text-article); margin-bottom: 2rem;">${message}</p>
              <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button id="${id}-cancel" class="btn-secondary" style="flex: 1;">Cancel</button>
                <button id="${id}-ok" class="btn-primary" style="flex: 1;">Confirm</button>
              </div>
            </div>
          </div>
        </div>
      `;
      this._createModal(html, id);
      
      document.getElementById(`${id}-cancel`).addEventListener('click', () => {
        this._closeModal(id);
        resolve(false);
      });
      document.getElementById(`${id}-ok`).addEventListener('click', () => {
        this._closeModal(id);
        resolve(true);
      });
    });
  },

  prompt(message, title = 'Input Required', type = 'text') {
    return new Promise(resolve => {
      const id = 'dialog-prompt-' + Math.random().toString(36).substr(2, 9);
      const html = `
        <div class="modal-overlay" id="${id}" style="z-index: 9999;">
          <div class="modal" style="max-width: 400px;">
            <div class="modal-header" style="border-bottom: none; padding-bottom: 0;">
              <h3>${title}</h3>
            </div>
            <div class="modal-body" style="padding: 1.5rem 2rem;">
              <p style="color: var(--text-article); margin-bottom: 1rem;">${message}</p>
              <input type="${type}" id="${id}-input" class="form-textarea" style="min-height: 48px; width: 100%; margin-bottom: 1.5rem; user-select: auto; pointer-events: auto;">
              <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button id="${id}-cancel" class="btn-secondary" style="flex: 1;">Cancel</button>
                <button id="${id}-ok" class="btn-primary" style="flex: 1;">Submit</button>
              </div>
            </div>
          </div>
        </div>
      `;
      this._createModal(html, id);
      
      const input = document.getElementById(`${id}-input`);
      setTimeout(() => input.focus(), 100);
      
      document.getElementById(`${id}-cancel`).addEventListener('click', () => {
        this._closeModal(id);
        resolve(null);
      });
      
      document.getElementById(`${id}-ok`).addEventListener('click', () => {
        const val = input.value;
        this._closeModal(id);
        resolve(val);
      });
      
      input.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
          const val = input.value;
          this._closeModal(id);
          resolve(val);
        }
      });
    });
  }
};
