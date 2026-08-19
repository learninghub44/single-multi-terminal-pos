// Customers Page
const CustomersPage = {
  customers: [],
  currentPage: 1,
  totalPages: 1,

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Customers</h1>
        <button class="btn btn-primary" onclick="CustomersPage.showAddModal()">+ Add Customer</button>
      </div>

      <div class="card">
        <div class="filters-bar">
          <div class="search-input">
            <input type="text" id="customers-search" class="form-input" placeholder="Search customers...">
          </div>
        </div>

        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="customers-table-body">
              <tr><td colspan="5" class="text-center"><div class="spinner"></div></td></tr>
            </tbody>
          </table>
        </div>

        <div id="customers-pagination" class="pagination"></div>
      </div>
    `;

    await this.loadData();
    this.setupEventListeners();
  },

  async loadData() {
    try {
      const search = document.getElementById('customers-search')?.value || '';
      const response = await Api.get(API.CUSTOMERS, {
        page: this.currentPage,
        limit: 20,
        search
      });

      if (response.success) {
        this.customers = response.data.customers;
        this.totalPages = response.data.pagination.total_pages;
        this.renderTable();
        this.renderPagination();
      }
    } catch (error) {
      Toast.show('Failed to load customers', 'error');
    }
  },

  renderTable() {
    const tbody = document.getElementById('customers-table-body');
    if (!this.customers.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No customers found</td></tr>';
      return;
    }

    tbody.innerHTML = this.customers.map(c => `
      <tr>
        <td><strong>${Utils.escapeHtml(c.name)}</strong></td>
        <td>${c.phone || '-'}</td>
        <td>${c.email || '-'}</td>
        <td>${Utils.formatDate(c.created_at)}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="CustomersPage.showEditModal('${c.id}')">Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="CustomersPage.viewHistory('${c.id}')">History</button>
        </td>
      </tr>
    `).join('');
  },

  renderPagination() {
    const container = document.getElementById('customers-pagination');
    if (this.totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';
    html += `<button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="CustomersPage.goToPage(${this.currentPage - 1})">Previous</button>`;
    for (let i = 1; i <= this.totalPages; i++) {
      html += `<button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" onclick="CustomersPage.goToPage(${i})">${i}</button>`;
    }
    html += `<button class="pagination-btn" ${this.currentPage === this.totalPages ? 'disabled' : ''} onclick="CustomersPage.goToPage(${this.currentPage + 1})">Next</button>`;
    container.innerHTML = html;
  },

  setupEventListeners() {
    document.getElementById('customers-search')?.addEventListener('input',
      Utils.debounce(() => {
        this.currentPage = 1;
        this.loadData();
      }, 300)
    );
  },

  goToPage(page) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadData();
  },

  showAddModal() {
    const content = `
      <form id="customer-form">
        <div class="form-group">
          <label for="customer-name">Name *</label>
          <input type="text" id="customer-name" class="form-input" required>
        </div>
        <div class="form-group">
          <label for="customer-phone">Phone</label>
          <input type="tel" id="customer-phone" class="form-input">
        </div>
        <div class="form-group">
          <label for="customer-email">Email</label>
          <input type="email" id="customer-email" class="form-input">
        </div>
      </form>
    `;

    Modal.show('Add Customer', content, {
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="CustomersPage.saveCustomer()">Save</button>
      `
    });
  },

  showEditModal(customerId) {
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) return;

    const content = `
      <form id="customer-form">
        <div class="form-group">
          <label for="customer-name">Name *</label>
          <input type="text" id="customer-name" class="form-input" value="${Utils.escapeHtml(customer.name)}" required>
        </div>
        <div class="form-group">
          <label for="customer-phone">Phone</label>
          <input type="tel" id="customer-phone" class="form-input" value="${customer.phone || ''}">
        </div>
        <div class="form-group">
          <label for="customer-email">Email</label>
          <input type="email" id="customer-email" class="form-input" value="${customer.email || ''}">
        </div>
      </form>
    `;

    Modal.show('Edit Customer', content, {
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="CustomersPage.updateCustomer('${customerId}')">Update</button>
      `
    });
  },

  async saveCustomer() {
    const data = {
      name: document.getElementById('customer-name').value,
      phone: document.getElementById('customer-phone').value || null,
      email: document.getElementById('customer-email').value || null
    };

    if (!data.name) {
      Toast.show('Customer name is required', 'error');
      return;
    }

    try {
      const response = await Api.post(API.CUSTOMERS, data);
      if (response.success) {
        Modal.close();
        Toast.show('Customer created successfully', 'success');
        this.loadData();
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to create customer', 'error');
    }
  },

  async updateCustomer(customerId) {
    const data = {
      name: document.getElementById('customer-name').value,
      phone: document.getElementById('customer-phone').value || null,
      email: document.getElementById('customer-email').value || null
    };

    try {
      const response = await Api.put(`${API.CUSTOMERS}/${customerId}`, data);
      if (response.success) {
        Modal.close();
        Toast.show('Customer updated successfully', 'success');
        this.loadData();
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to update customer', 'error');
    }
  },

  async viewHistory(customerId) {
    try {
      const response = await Api.get(`${API.CUSTOMERS}/${customerId}/history`);
      if (!response.success) {
        Toast.show('Failed to load history', 'error');
        return;
      }

      const sales = response.data.sales || [];
      const content = sales.length ? `
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${sales.map(s => `
                <tr>
                  <td>${s.receipt_number}</td>
                  <td>${Utils.formatDate(s.created_at)}</td>
                  <td>${Utils.formatCurrency(s.total)}</td>
                  <td><span class="badge ${Utils.getStatusBadgeClass(s.status)}">${Utils.capitalize(s.status)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="empty-state"><p>No purchase history</p></div>';

      Modal.show('Customer History', content);
    } catch (error) {
      Toast.show('Failed to load customer history', 'error');
    }
  }
};

Router.registerPage('customers', (container) => CustomersPage.render(container));
