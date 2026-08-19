// Terminals Page
const TerminalsPage = {
  terminals: [],

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Terminals</h1>
        <button class="btn btn-primary" onclick="TerminalsPage.showAddModal()">+ Add Terminal</button>
      </div>

      <div class="card">
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Location</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="terminals-table-body">
              <tr><td colspan="6" class="text-center"><div class="spinner"></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    try {
      const response = await Api.get(API.TERMINALS);
      if (response.success) {
        this.terminals = response.data.terminals;
        this.renderTable();
      }
    } catch (error) {
      Toast.show('Failed to load terminals', 'error');
    }
  },

  renderTable() {
    const tbody = document.getElementById('terminals-table-body');
    if (!this.terminals.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No terminals found. Create your first terminal to get started.</td></tr>';
      return;
    }

    tbody.innerHTML = this.terminals.map(t => `
      <tr>
        <td><strong>${Utils.escapeHtml(t.terminal_code)}</strong></td>
        <td>${Utils.escapeHtml(t.name)}</td>
        <td>${t.location || '-'}</td>
        <td><span class="badge ${t.status === 'active' ? 'badge-success' : 'badge-secondary'}">${Utils.capitalize(t.status)}</span></td>
        <td>${Utils.formatDate(t.created_at)}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="TerminalsPage.showEditModal('${t.id}')">Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="TerminalsPage.viewActivity('${t.id}')">Activity</button>
          ${t.status === 'active' ?
            `<button class="btn btn-ghost btn-sm text-warning" onclick="TerminalsPage.toggleStatus('${t.id}', 'inactive')">Deactivate</button>` :
            `<button class="btn btn-ghost btn-sm text-success" onclick="TerminalsPage.toggleStatus('${t.id}', 'active')">Activate</button>`
          }
        </td>
      </tr>
    `).join('');
  },

  showAddModal() {
    const content = `
      <form id="terminal-form">
        <div class="form-group">
          <label for="terminal-code">Terminal Code *</label>
          <input type="text" id="terminal-code" class="form-input" placeholder="e.g. POS-01" required pattern="[A-Z0-9-]+" style="text-transform: uppercase;">
          <div class="form-hint">Uppercase letters, numbers, and hyphens only</div>
        </div>
        <div class="form-group">
          <label for="terminal-name">Name *</label>
          <input type="text" id="terminal-name" class="form-input" placeholder="e.g. Counter 1" required>
        </div>
        <div class="form-group">
          <label for="terminal-location">Location</label>
          <input type="text" id="terminal-location" class="form-input" placeholder="e.g. Main Entrance">
        </div>
      </form>
    `;

    Modal.show('Add Terminal', content, {
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="TerminalsPage.saveTerminal()">Save</button>
      `
    });
  },

  showEditModal(terminalId) {
    const terminal = this.terminals.find(t => t.id === terminalId);
    if (!terminal) return;

    const content = `
      <form id="terminal-form">
        <div class="form-group">
          <label for="terminal-code">Terminal Code *</label>
          <input type="text" id="terminal-code" class="form-input" value="${Utils.escapeHtml(terminal.terminal_code)}" required pattern="[A-Z0-9-]+" style="text-transform: uppercase;">
          <div class="form-hint">Uppercase letters, numbers, and hyphens only</div>
        </div>
        <div class="form-group">
          <label for="terminal-name">Name *</label>
          <input type="text" id="terminal-name" class="form-input" value="${Utils.escapeHtml(terminal.name)}" required>
        </div>
        <div class="form-group">
          <label for="terminal-location">Location</label>
          <input type="text" id="terminal-location" class="form-input" value="${terminal.location || ''}">
        </div>
        <div class="form-group">
          <label for="terminal-status">Status</label>
          <select id="terminal-status" class="form-select">
            <option value="active" ${terminal.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="inactive" ${terminal.status === 'inactive' ? 'selected' : ''}>Inactive</option>
          </select>
        </div>
      </form>
    `;

    Modal.show('Edit Terminal', content, {
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="TerminalsPage.updateTerminal('${terminalId}')">Update</button>
      `
    });
  },

  async saveTerminal() {
    const data = {
      terminal_code: document.getElementById('terminal-code').value.toUpperCase(),
      name: document.getElementById('terminal-name').value,
      location: document.getElementById('terminal-location').value || null
    };

    if (!data.terminal_code || !data.name) {
      Toast.show('Terminal code and name are required', 'error');
      return;
    }

    try {
      const response = await Api.post(API.TERMINALS, data);
      if (response.success) {
        Modal.close();
        Toast.show('Terminal created successfully', 'success');
        this.loadData();
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to create terminal', 'error');
    }
  },

  async updateTerminal(terminalId) {
    const data = {
      terminal_code: document.getElementById('terminal-code').value.toUpperCase(),
      name: document.getElementById('terminal-name').value,
      location: document.getElementById('terminal-location').value || null,
      status: document.getElementById('terminal-status').value
    };

    try {
      const response = await Api.put(`${API.TERMINALS}/${terminalId}`, data);
      if (response.success) {
        Modal.close();
        Toast.show('Terminal updated successfully', 'success');
        this.loadData();
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to update terminal', 'error');
    }
  },

  async toggleStatus(terminalId, newStatus) {
    try {
      const response = await Api.put(`${API.TERMINALS}/${terminalId}`, { status: newStatus });
      if (response.success) {
        Toast.show(`Terminal ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'success');
        this.loadData();
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to update terminal status', 'error');
    }
  },

  async viewActivity(terminalId) {
    try {
      const response = await Api.get(`${API.TERMINALS}/${terminalId}/activity`);
      if (!response.success) {
        Toast.show('Failed to load activity', 'error');
        return;
      }

      const { recent_sales, recent_sessions } = response.data;

      const content = `
        <div class="mb-lg">
          <h4>Recent Sales</h4>
          ${recent_sales?.length ? `
            <div class="table-container">
              <table class="table">
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Amount</th>
                    <th>Cashier</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${recent_sales.map(s => `
                    <tr>
                      <td>${s.receipt_number}</td>
                      <td>${Utils.formatCurrency(s.total)}</td>
                      <td>${s.users?.full_name || '-'}</td>
                      <td>${Utils.formatDateTime(s.created_at)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p class="text-muted">No recent sales</p>'}
        </div>

        <div>
          <h4>Cash Sessions</h4>
          ${recent_sessions?.length ? `
            <div class="table-container">
              <table class="table">
                <thead>
                  <tr>
                    <th>Cashier</th>
                    <th>Opening</th>
                    <th>Expected</th>
                    <th>Actual</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${recent_sessions.map(s => `
                    <tr>
                      <td>${s.users?.full_name || '-'}</td>
                      <td>${Utils.formatCurrency(s.opening_cash)}</td>
                      <td>${s.status === 'closed' ? Utils.formatCurrency(s.expected_cash) : '-'}</td>
                      <td>${s.actual_cash !== null ? Utils.formatCurrency(s.actual_cash) : '-'}</td>
                      <td><span class="badge ${s.status === 'open' ? 'badge-warning' : 'badge-success'}">${Utils.capitalize(s.status)}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p class="text-muted">No cash sessions</p>'}
        </div>
      `;

      Modal.show('Terminal Activity', content);
    } catch (error) {
      Toast.show('Failed to load terminal activity', 'error');
    }
  }
};

Router.registerPage('terminals', (container) => TerminalsPage.render(container));
