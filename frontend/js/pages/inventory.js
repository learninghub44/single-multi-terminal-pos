// Inventory Page
const InventoryPage = {
  movements: [],
  products: [],
  currentPage: 1,
  totalPages: 1,

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Inventory</h1>
        <button class="btn btn-primary" onclick="InventoryPage.showAdjustModal()">+ Adjust Stock</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Low Stock Items</div>
          <div class="stat-value" id="low-stock-count">Loading...</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Stock Value</div>
          <div class="stat-value" id="total-stock-value">Loading...</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Stock Movements</h3>
        </div>

        <div class="filters-bar">
          <select id="inventory-type" class="form-select">
            <option value="">All Types</option>
            <option value="opening_stock">Opening Stock</option>
            <option value="purchase">Purchase</option>
            <option value="sale">Sale</option>
            <option value="return">Return</option>
            <option value="damage">Damage</option>
            <option value="adjustment">Adjustment</option>
          </select>
        </div>

        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody id="inventory-table-body">
              <tr><td colspan="5" class="text-center"><div class="spinner"></div></td></tr>
            </tbody>
          </table>
        </div>

        <div id="inventory-pagination" class="pagination"></div>
      </div>
    `;

    await this.loadData();
    this.setupEventListeners();
  },

  async loadData() {
    try {
      const type = document.getElementById('inventory-type')?.value || '';
      const [movementsRes, lowStockRes] = await Promise.all([
        Api.get(API.INVENTORY, { page: this.currentPage, type }),
        Api.get(`${API.INVENTORY}/low-stock`)
      ]);

      if (movementsRes.success) {
        this.movements = movementsRes.data.movements;
        this.totalPages = movementsRes.data.pagination.total_pages;
        this.renderTable();
        this.renderPagination();
      }

      if (lowStockRes.success) {
        document.getElementById('low-stock-count').textContent = lowStockRes.data.products.length;
      }

      // Get inventory report for stock value
      const reportRes = await Api.get(API.REPORTS.INVENTORY);
      if (reportRes.success) {
        document.getElementById('total-stock-value').textContent = Utils.formatCurrency(reportRes.data.total_stock_value);
      }
    } catch (error) {
      Toast.show('Failed to load inventory', 'error');
    }
  },

  renderTable() {
    const tbody = document.getElementById('inventory-table-body');
    if (!this.movements.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No movements found</td></tr>';
      return;
    }

    const typeLabels = {
      opening_stock: 'Opening Stock',
      purchase: 'Purchase',
      sale: 'Sale',
      return: 'Return',
      damage: 'Damage',
      adjustment: 'Adjustment'
    };

    tbody.innerHTML = this.movements.map(m => `
      <tr>
        <td>${Utils.formatDateTime(m.created_at)}</td>
        <td>${m.products?.name || '-'}</td>
        <td><span class="badge ${m.type === 'sale' ? 'badge-danger' : m.type === 'purchase' ? 'badge-success' : 'badge-info'}">${typeLabels[m.type] || m.type}</span></td>
        <td class="${m.quantity > 0 ? 'text-success' : 'text-danger'}">${m.quantity > 0 ? '+' : ''}${m.quantity}</td>
        <td>${m.notes || '-'}</td>
      </tr>
    `).join('');
  },

  renderPagination() {
    const container = document.getElementById('inventory-pagination');
    if (this.totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';
    html += `<button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="InventoryPage.goToPage(${this.currentPage - 1})">Previous</button>`;
    
    for (let i = 1; i <= this.totalPages; i++) {
      html += `<button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" onclick="InventoryPage.goToPage(${i})">${i}</button>`;
    }

    html += `<button class="pagination-btn" ${this.currentPage === this.totalPages ? 'disabled' : ''} onclick="InventoryPage.goToPage(${this.currentPage + 1})">Next</button>`;
    
    container.innerHTML = html;
  },

  setupEventListeners() {
    document.getElementById('inventory-type')?.addEventListener('change', () => {
      this.currentPage = 1;
      this.loadData();
    });
  },

  goToPage(page) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadData();
  },

  async showAdjustModal() {
    // Load products for selection
    try {
      const res = await Api.get(API.PRODUCTS, { limit: 100, status: 'active' });
      if (res.success) {
        this.products = res.data.products;
      }
    } catch (error) {
      Toast.show('Failed to load products', 'error');
      return;
    }

    const content = `
      <form id="adjust-form">
        <div class="form-group">
          <label for="adjust-product">Product *</label>
          <select id="adjust-product" class="form-select" required>
            <option value="">Select Product</option>
            ${this.products.map(p => `<option value="${p.id}">${Utils.escapeHtml(p.name)} (Stock: ${p.stock_quantity})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="adjust-type">Type *</label>
          <select id="adjust-type" class="form-select" required>
            <option value="purchase">Purchase</option>
            <option value="return">Return</option>
            <option value="damage">Damage</option>
            <option value="adjustment">Adjustment</option>
          </select>
        </div>
        <div class="form-group">
          <label for="adjust-quantity">Quantity *</label>
          <input type="number" id="adjust-quantity" class="form-input" min="1" required>
        </div>
        <div class="form-group">
          <label for="adjust-notes">Notes</label>
          <textarea id="adjust-notes" class="form-textarea"></textarea>
        </div>
      </form>
    `;

    Modal.show('Adjust Stock', content, {
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="InventoryPage.processAdjustment()">Save</button>
      `
    });
  },

  async processAdjustment() {
    const data = {
      product_id: document.getElementById('adjust-product').value,
      type: document.getElementById('adjust-type').value,
      quantity: parseInt(document.getElementById('adjust-quantity').value),
      notes: document.getElementById('adjust-notes').value || null
    };

    if (!data.product_id || !data.quantity) {
      Toast.show('Please fill in all required fields', 'error');
      return;
    }

    try {
      const response = await Api.post(`${API.INVENTORY}/adjust`, data);
      if (response.success) {
        Modal.close();
        Toast.show('Stock adjusted successfully', 'success');
        this.loadData();
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to adjust stock', 'error');
    }
  }
};

Router.registerPage('inventory', (container) => InventoryPage.render(container));
