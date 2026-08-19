// Sales Page
const SalesPage = {
  sales: [],
  terminals: [],
  currentPage: 1,
  totalPages: 1,

  async render(container) {
    try {
      const response = await Api.get(API.TERMINALS);
      if (response.success) {
        this.terminals = response.data.terminals;
      }
    } catch (e) {}

    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Sales History</h1>
      </div>

      <div class="card">
        <div class="filters-bar">
          <div class="search-input">
            <input type="text" id="sales-search" class="form-input" placeholder="Search receipt number...">
          </div>
          <select id="sales-terminal" class="form-select">
            <option value="">All Terminals</option>
            ${this.terminals.map(t => `<option value="${t.id}">${Utils.escapeHtml(t.terminal_code)}</option>`).join('')}
          </select>
          <select id="sales-status" class="form-select">
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input type="date" id="sales-start-date" class="form-input">
          <input type="date" id="sales-end-date" class="form-input">
        </div>

        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Date</th>
                <th>Terminal</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="sales-table-body">
              <tr><td colspan="9" class="text-center"><div class="spinner"></div></td></tr>
            </tbody>
          </table>
        </div>

        <div id="sales-pagination" class="pagination"></div>
      </div>
    `;

    await this.loadData();
    this.setupEventListeners();
  },

  async loadData() {
    try {
      const search = document.getElementById('sales-search')?.value || '';
      const status = document.getElementById('sales-status')?.value || '';
      const terminalId = document.getElementById('sales-terminal')?.value || '';
      const startDate = document.getElementById('sales-start-date')?.value || '';
      const endDate = document.getElementById('sales-end-date')?.value || '';

      const response = await Api.get(API.SALES, {
        page: this.currentPage,
        limit: 20,
        search,
        status,
        terminal_id: terminalId,
        start_date: startDate,
        end_date: endDate
      });

      if (response.success) {
        this.sales = response.data.sales;
        this.totalPages = response.data.pagination.total_pages;
        this.renderTable();
        this.renderPagination();
      }
    } catch (error) {
      Toast.show('Failed to load sales', 'error');
    }
  },

  renderTable() {
    const tbody = document.getElementById('sales-table-body');
    if (!this.sales.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No sales found</td></tr>';
      return;
    }

    tbody.innerHTML = this.sales.map(sale => `
      <tr>
        <td><strong>${sale.receipt_number}</strong></td>
        <td>${Utils.formatDateTime(sale.created_at)}</td>
        <td>${sale.terminals?.terminal_code || '-'}</td>
        <td>${sale.customers?.name || 'Walk-in'}</td>
        <td>${sale.sale_items?.length || 0}</td>
        <td><strong>${Utils.formatCurrency(sale.total)}</strong></td>
        <td>
          <span class="badge badge-info">
            ${Utils.getPaymentMethodIcon(sale.payments?.[0]?.method)} ${Utils.getPaymentMethodName(sale.payments?.[0]?.method)}
          </span>
        </td>
        <td><span class="badge ${Utils.getStatusBadgeClass(sale.status)}">${Utils.capitalize(sale.status)}</span></td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="SalesPage.viewSale('${sale.id}')">View</button>
          <button class="btn btn-ghost btn-sm" onclick="SalesPage.printReceipt('${sale.receipt_number}')">Print</button>
        </td>
      </tr>
    `).join('');
  },

  renderPagination() {
    const container = document.getElementById('sales-pagination');
    if (this.totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';
    html += `<button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="SalesPage.goToPage(${this.currentPage - 1})">Previous</button>`;
    
    for (let i = 1; i <= this.totalPages; i++) {
      html += `<button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" onclick="SalesPage.goToPage(${i})">${i}</button>`;
    }

    html += `<button class="pagination-btn" ${this.currentPage === this.totalPages ? 'disabled' : ''} onclick="SalesPage.goToPage(${this.currentPage + 1})">Next</button>`;
    
    container.innerHTML = html;
  },

  setupEventListeners() {
    document.getElementById('sales-search')?.addEventListener('input', 
      Utils.debounce(() => {
        this.currentPage = 1;
        this.loadData();
      }, 300)
    );

    ['sales-status', 'sales-start-date', 'sales-end-date', 'sales-terminal'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        this.currentPage = 1;
        this.loadData();
      });
    });
  },

  goToPage(page) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadData();
  },

  async viewSale(saleId) {
    try {
      const response = await Api.get(`${API.SALES}/${saleId}`);
      if (!response.success) {
        Toast.show('Sale not found', 'error');
        return;
      }

      const sale = response.data;
      const items = sale.sale_items || [];
      const payment = sale.payments?.[0];

      const content = `
        <div class="sale-details">
          <div class="mb-md">
            <strong>Receipt:</strong> ${sale.receipt_number}<br>
            <strong>Date:</strong> ${Utils.formatDateTime(sale.created_at)}<br>
            <strong>Terminal:</strong> ${sale.terminals?.terminal_code || 'N/A'}<br>
            <strong>Customer:</strong> ${sale.customers?.name || 'Walk-in'}<br>
            <strong>Cashier:</strong> ${sale.users?.full_name || '-'}
          </div>

          <div class="table-container mb-md">
            <table class="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(item => `
                  <tr>
                    <td>${Utils.escapeHtml(item.product_name_snapshot)}</td>
                    <td>${item.quantity}</td>
                    <td>${Utils.formatCurrency(item.unit_price)}</td>
                    <td>${Utils.formatCurrency(item.subtotal)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="text-right">
            <div>Subtotal: ${Utils.formatCurrency(sale.subtotal)}</div>
            ${sale.discount > 0 ? `<div>Discount: -${Utils.formatCurrency(sale.discount)}</div>` : ''}
            ${sale.tax > 0 ? `<div>Tax: ${Utils.formatCurrency(sale.tax)}</div>` : ''}
            <div class="font-bold text-lg">Total: ${Utils.formatCurrency(sale.total)}</div>
          </div>

          <div class="mt-md">
            <strong>Payment:</strong> ${Utils.getPaymentMethodName(payment?.method)}<br>
            ${payment?.provider_reference ? `<strong>Reference:</strong> ${payment.provider_reference}` : ''}
          </div>
        </div>
      `;

      Modal.show('Sale Details', content, {
        footer: `
          <button class="btn btn-secondary" onclick="Modal.close()">Close</button>
          <button class="btn btn-primary" onclick="SalesPage.printReceipt('${sale.receipt_number}')">Print Receipt</button>
        `
      });
    } catch (error) {
      Toast.show('Failed to load sale details', 'error');
    }
  },

  async printReceipt(receiptNumber) {
    try {
      const response = await fetch(API.RECEIPTS(receiptNumber) + '/html', {
        headers: {
          'Authorization': `Bearer ${Auth.getToken()}`
        }
      });

      if (response.ok) {
        const html = await response.text();
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
      }
    } catch (error) {
      Toast.show('Failed to load receipt', 'error');
    }
  }
};

Router.registerPage('sales', (container) => SalesPage.render(container));
