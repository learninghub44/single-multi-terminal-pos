// Modal Component
const ModalComponent = {
  show(title, content, options = {}) {
    const container = document.getElementById('modal-container');
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        ${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}
      </div>
    `;

    modal.querySelector('.modal-close').onclick = () => this.close();
    modal.onclick = (e) => {
      if (e.target === modal) this.close();
    };

    container.appendChild(modal);
    return modal;
  },

  close() {
    const container = document.getElementById('modal-container');
    container.innerHTML = '';
  }
};
