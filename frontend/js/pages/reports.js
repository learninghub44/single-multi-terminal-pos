// Reports Page
const ReportsPage = {
  terminals: [],
  selectedTerminal: '',

  async render(container) {
    // Load terminals for filter
    try {
      const response = await Api.get(API.TERMINALS);
      if (response.success) {
        this.terminals = response.data.terminals;
      }
    } catch (e) {
      // Ignore - terminals are optional
    }

    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Reports</h1>
      </div>

      <div class="filters-bar">
        <input type="date" id="report-start-date" class="form-input">
        <input type="date" id="report-end-date" class="form-input">
        <select id="report-terminal" class="form-select">
          <option value="">All Terminals</option>
          ${this.terminals.map(t => `<option value="${t.id}">${Utils.escapeHtml(t.terminal_code)} - ${Utils.escapeHtml(t.name)}</option>`).join('')}
        </select>
        <button class="btn btn-primary" onclick="ReportsPage.loadAll()">Generate Report</button>
      </div>

      <div class="grid grid-cols-2 mb-lg">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Sales Summary</h3>
          </div>
          <div id="sales-summary">
            <div class="spinner"></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Payment Methods</h3>
          </div>
          <div id="payment-summary">
            <div class="spinner"></div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 mb-lg">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Profit Summary</h3>
          </div>
          <div id="profit-summary">
            <div class="spinner"></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Expenses Summary</h3>
          </div>
          <div id="expenses-summary">
            <div class="spinner"></div>
          </div>
        </div>
      </div>

      <div class="card mb-lg">
        <div class="card-header">
          <h3 class="card-title">Top Selling Products</h3>
        </div>
        <div id="top-products-report">
          <div class="spinner"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Inventory Status</h3>
        </div>
        <div id="inventory-report">
          <div class="spinner"></div>
        </div>
      </div>
    `;

    await this.loadAll();
  },

  getParams() {
    const startDate = document.getElementById('report-start-date')?.value || '';
    const endDate = document.getElementById('report-end-date')?.value || '';
    const terminalId = document.getElementById('report-terminal')?.value || '';
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (terminalId) params.terminal_id = terminalId;
    return params;
  },

  async loadAll() {
    const params = this.getParams();

    try {
      const [salesRes, paymentRes, profitRes, expenseRes, productRes, inventoryRes] = await Promise.all([
        Api.get(API.REPORTS.SALES, params),
        Api.get(API.REPORTS.PAYMENT_METHODS, params),
        Api.get(API.REPORTS.PROFIT, params),
        Api.get(API.REPORTS.EXPENSES, params),
        Api.get(API.REPORTS.PRODUCTS),
        Api.get(API.REPORTS.INVENTORY)
      ]);

      if (salesRes.success) {
        this.renderSalesSummary(salesRes.data);
      }
      if (paymentRes.success) {
        this.renderPaymentSummary(paymentRes.data);
      }
      if (profitRes.success) {
        this.renderProfitSummary(profitRes.data);
      }
      if (expenseRes.success) {
        this.renderExpensesSummary(expenseRes.data);
      }
      if (productRes.success) {
        this.renderTopProducts(productRes.data.products);
      }
      if (inventoryRes.success) {
        this.renderInventoryReport(inventoryRes.data);
      }
    } catch (error) {
      Toast.show('Failed to load reports', 'error');
    }
  },

  renderSalesSummary(data) {
    document.getElementById('sales-summary').innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Total Sales</div>
        <div class="stat-value">${Utils.formatCurrency(data.summary.total_sales)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Transactions</div>
        <div class="stat-value">${data.summary.total_transactions}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Average Sale</div>
        <div class="stat-value">${Utils.formatCurrency(data.summary.average_sale)}</div>
      </div>
    `;
  },

  renderPaymentSummary(data) {
    document.getElementById('payment-summary').innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Cash</div>
        <div class="stat-value">${Utils.formatCurrency(data.cash)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">M-Pesa</div>
        <div class="stat-value">${Utils.formatCurrency(data.mpesa)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">PayHero</div>
        <div class="stat-value">${Utils.formatCurrency(data.payhero)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total</div>
        <div class="stat-value font-bold">${Utils.formatCurrency(data.total)}</div>
      </div>
    `;
  },

  renderProfitSummary(data) {
    document.getElementById('profit-summary').innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Revenue</div>
        <div class="stat-value">${Utils.formatCurrency(data.revenue)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Cost of Goods</div>
        <div class="stat-value">${Utils.formatCurrency(data.cost_of_goods)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Gross Profit</div>
        <div class="stat-value ${data.gross_profit >= 0 ? 'positive' : 'negative'}">${Utils.formatCurrency(data.gross_profit)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Expenses</div>
        <div class="stat-value">${Utils.formatCurrency(data.expenses)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Net Profit (Estimated)</div>
        <div class="stat-value ${data.net_profit >= 0 ? 'positive' : 'negative'}">${Utils.formatCurrency(data.net_profit)}</div>
      </div>
    `;
  },

  renderExpensesSummary(data) {
    const categories = Object.entries(data.by_category);
    document.getElementById('expenses-summary').innerHTML = `
      <div class="stat-card mb-md">
        <div class="stat-label">Total Expenses</div>
        <div class="stat-value">${Utils.formatCurrency(data.total)}</div>
      </div>
      ${categories.length ? `
        <div class="table-container">
          <table class="table">
            <thead><tr><th>Category</th><th>Amount</th></tr></thead>
            <tbody>
              ${categories.map(([cat, amount]) => `
                <tr><td>${cat}</td><td>${Utils.formatCurrency(amount)}</td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<p class="text-muted">No expenses recorded</p>'}
    `;
  },

  renderTopProducts(products) {
    const container = document.getElementById('top-products-report');
    if (!products.length) {
      container.innerHTML = '<p class="text-muted">No product data</p>';
      return;
    }

    container.innerHTML = `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty Sold</th>
              <th>Revenue</th>
              <th>Profit</th>
            </tr>
          </thead>
          <tbody>
            ${products.slice(0, 10).map(p => `
              <tr>
                <td>${Utils.escapeHtml(p.product_name)}</td>
                <td>${p.quantity_sold}</td>
                <td>${Utils.formatCurrency(p.revenue)}</td>
                <td class="${p.profit >= 0 ? 'text-success' : 'text-danger'}">${Utils.formatCurrency(p.profit)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderInventoryReport(data) {
    const container = document.getElementById('inventory-report');
    container.innerHTML = `
      <div class="stat-card mb-md">
        <div class="stat-label">Total Stock Value</div>
        <div class="stat-value">${Utils.formatCurrency(data.total_stock_value)}</div>
      </div>
      <div class="stat-card mb-md">
        <div class="stat-label">Low Stock Items (${data.low_stock.length})</div>
      </div>
      ${data.low_stock.length ? `
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Stock</th>
                <th>Threshold</th>
              </tr>
            </thead>
            <tbody>
              ${data.low_stock.map(p => `
                <tr>
                  <td>${Utils.escapeHtml(p.name)}</td>
                  <td class="text-warning font-bold">${p.stock_quantity}</td>
                  <td>${p.low_stock_threshold}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<p class="text-success">All products are well stocked</p>'}
    `;
  }
};

Router.registerPage('reports', (container) => ReportsPage.render(container));
