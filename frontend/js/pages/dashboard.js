// Dashboard Page
const DashboardPage = {
  async render(container) {
    const terminal = Auth.getTerminal();
    const user = Auth.user;
    const greeting = this.getGreeting();
    const dateStr = this.formatDate(new Date());

    container.innerHTML = `
      <div class="dashboard">
        <!-- Hero Section -->
        <div class="dash-hero">
          <div class="dash-hero-text">
            <h1 class="dash-greeting">${greeting}, ${Utils.escapeHtml(user?.full_name?.split(' ')[0] || 'there')}</h1>
            <p class="dash-date">${dateStr}</p>
          </div>
          <button class="btn btn-primary btn-lg dash-new-sale" onclick="Router.navigate('pos')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Sale
          </button>
        </div>

        <!-- Today's Performance -->
        <div class="dash-section">
          <div class="dash-section-header">
            <h2 class="dash-section-title">Today's Performance</h2>
          </div>
          <div class="dash-hero-metrics">
            <div class="dash-hero-metric">
              <div class="dash-hero-value" id="stat-total-sales">—</div>
              <div class="dash-hero-label">Total sales today</div>
              <div class="dash-hero-change" id="stat-sales-change"></div>
            </div>
          </div>
          <div class="dash-metrics-row">
            <div class="dash-metric">
              <div class="dash-metric-value" id="stat-transactions">—</div>
              <div class="dash-metric-label">Transactions</div>
            </div>
            <div class="dash-metric">
              <div class="dash-metric-value" id="stat-avg-sale">—</div>
              <div class="dash-metric-label">Average sale</div>
            </div>
            <div class="dash-metric">
              <div class="dash-metric-value" id="stat-items-sold">—</div>
              <div class="dash-metric-label">Items sold</div>
            </div>
          </div>
        </div>

        <!-- Main Grid -->
        <div class="dash-grid">
          <!-- Left Column -->
          <div class="dash-col-main">
            <!-- Payment Breakdown -->
            <div class="dash-section">
              <div class="dash-section-header">
                <h2 class="dash-section-title">Payment Breakdown</h2>
              </div>
              <div class="dash-payments" id="dash-payments">
                <div class="dash-payment-row">
                  <div class="dash-payment-label">Cash</div>
                  <div class="dash-payment-bar-track">
                    <div class="dash-payment-bar" id="bar-cash" style="width:0%"></div>
                  </div>
                  <div class="dash-payment-value" id="stat-cash">—</div>
                </div>
                <div class="dash-payment-row">
                  <div class="dash-payment-label">M-Pesa</div>
                  <div class="dash-payment-bar-track">
                    <div class="dash-payment-bar" id="bar-mpesa" style="width:0%"></div>
                  </div>
                  <div class="dash-payment-value" id="stat-mpesa">—</div>
                </div>
                <div class="dash-payment-row">
                  <div class="dash-payment-label">PayHero</div>
                  <div class="dash-payment-bar-track">
                    <div class="dash-payment-bar" id="bar-payhero" style="width:0%"></div>
                  </div>
                  <div class="dash-payment-value" id="stat-payhero">—</div>
                </div>
                <div class="dash-payment-row">
                  <div class="dash-payment-label">Till (Manual)</div>
                  <div class="dash-payment-bar-track">
                    <div class="dash-payment-bar" id="bar-manual" style="width:0%"></div>
                  </div>
                  <div class="dash-payment-value" id="stat-manual">—</div>
                </div>
              </div>
            </div>

            <!-- Terminal Performance -->
            ${user?.role !== 'cashier' ? `
            <div class="dash-section" id="terminal-section">
              <div class="dash-section-header">
                <h2 class="dash-section-title">Terminal Performance</h2>
              </div>
              <div id="terminal-performance">
                <div class="dash-loading"></div>
              </div>
            </div>
            ` : ''}

            <!-- Recent Transactions -->
            <div class="dash-section">
              <div class="dash-section-header">
                <h2 class="dash-section-title">Recent Transactions</h2>
                <a href="#/sales" class="dash-link">View all</a>
              </div>
              <div id="recent-transactions">
                <div class="dash-loading"></div>
              </div>
            </div>
          </div>

          <!-- Right Column -->
          <div class="dash-col-side">
            <!-- Quick Actions -->
            <div class="dash-section">
              <div class="dash-section-header">
                <h2 class="dash-section-title">Quick Actions</h2>
              </div>
              <div class="dash-actions">
                <a href="#/pos" class="dash-action-btn dash-action-primary">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                  <span>New Sale</span>
                </a>
                <a href="#/products" class="dash-action-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                  <span>Add Product</span>
                </a>
                <a href="#/inventory" class="dash-action-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  <span>Stock Adjustment</span>
                </a>
                <a href="#/sales" class="dash-action-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  <span>View Sales</span>
                </a>
              </div>
            </div>

            <!-- Cash Session -->
            <div class="dash-section" id="cash-session-section">
              <div class="dash-section-header">
                <h2 class="dash-section-title">Cash Session</h2>
              </div>
              <div id="cash-session-info">
                <div class="dash-loading"></div>
              </div>
            </div>

            <!-- Low Stock -->
            <div class="dash-section">
              <div class="dash-section-header">
                <h2 class="dash-section-title">Low Stock</h2>
                <a href="#/inventory" class="dash-link">View inventory</a>
              </div>
              <div id="low-stock-list">
                <div class="dash-loading"></div>
              </div>
            </div>

            <!-- Expenses & Profit -->
            <div class="dash-section">
              <div class="dash-section-header">
                <h2 class="dash-section-title">Financial Overview</h2>
              </div>
              <div class="dash-finance" id="dash-finance">
                <div class="dash-finance-row">
                  <span class="dash-finance-label">Revenue</span>
                  <span class="dash-finance-value" id="stat-revenue">—</span>
                </div>
                <div class="dash-finance-row">
                  <span class="dash-finance-label">Cost of Goods</span>
                  <span class="dash-finance-value" id="stat-cogs">—</span>
                </div>
                <div class="dash-finance-row">
                  <span class="dash-finance-label">Expenses</span>
                  <span class="dash-finance-value" id="stat-expenses">—</span>
                </div>
                <div class="dash-finance-row dash-finance-total">
                  <span class="dash-finance-label">Estimated Profit</span>
                  <span class="dash-finance-value" id="stat-profit">—</span>
                </div>
              </div>
            </div>

            <!-- Top Products -->
            <div class="dash-section">
              <div class="dash-section-header">
                <h2 class="dash-section-title">Top Products</h2>
              </div>
              <div id="top-products">
                <div class="dash-loading"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
  },

  getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  },

  formatDate(d) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
  },

  async loadData() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();
      const terminal = Auth.getTerminal();

      // Sales params
      const salesParams = { start_date: todayStr };
      if (terminal) salesParams.terminal_id = terminal.id;

      // Load sales
      const salesRes = await Api.get(API.REPORTS.SALES, salesParams);
      if (salesRes.success) {
        const s = salesRes.data.summary;
        document.getElementById('stat-total-sales').textContent = Utils.formatCurrency(s.total_sales);
        document.getElementById('stat-transactions').textContent = s.total_transactions;
        document.getElementById('stat-avg-sale').textContent = Utils.formatCurrency(s.average_sale);
      }

      // Load payments
      const paymentParams = { start_date: todayStr };
      if (terminal) paymentParams.terminal_id = terminal.id;
      const paymentRes = await Api.get(API.REPORTS.PAYMENT_METHODS, paymentParams);
      if (paymentRes.success) {
        const d = paymentRes.data;
        const max = Math.max(d.cash, d.mpesa, d.payhero, d.manual || 0, 1);
        document.getElementById('stat-cash').textContent = Utils.formatCurrency(d.cash);
        document.getElementById('stat-mpesa').textContent = Utils.formatCurrency(d.mpesa);
        document.getElementById('stat-payhero').textContent = Utils.formatCurrency(d.payhero);
        document.getElementById('stat-manual').textContent = Utils.formatCurrency(d.manual || 0);
        document.getElementById('bar-cash').style.width = `${(d.cash / max) * 100}%`;
        document.getElementById('bar-mpesa').style.width = `${(d.mpesa / max) * 100}%`;
        document.getElementById('bar-payhero').style.width = `${(d.payhero / max) * 100}%`;
        document.getElementById('bar-manual').style.width = `${((d.manual || 0) / max) * 100}%`;
      }

      // Load profit
      const profitRes = await Api.get(API.REPORTS.PROFIT, { start_date: todayStr });
      if (profitRes.success) {
        const p = profitRes.data;
        document.getElementById('stat-revenue').textContent = Utils.formatCurrency(p.revenue);
        document.getElementById('stat-cogs').textContent = Utils.formatCurrency(p.cost_of_goods);
        document.getElementById('stat-profit').textContent = Utils.formatCurrency(p.net_profit);
        const profitEl = document.getElementById('stat-profit');
        profitEl.classList.toggle('text-success', p.net_profit >= 0);
        profitEl.classList.toggle('text-danger', p.net_profit < 0);
      }

      // Load expenses
      const expenseRes = await Api.get(API.REPORTS.EXPENSES, { start_date: todayStr });
      if (expenseRes.success) {
        document.getElementById('stat-expenses').textContent = Utils.formatCurrency(expenseRes.data.total);
      }

      // Load items sold from sales detail
      const recentParams = { limit: 5 };
      if (terminal) recentParams.terminal_id = terminal.id;
      const recentRes = await Api.get(API.SALES, recentParams);
      if (recentRes.success) {
        this.renderRecentTransactions(recentRes.data.sales);
        // Sum items sold
        let itemsSold = 0;
        recentRes.data.sales.forEach(s => { itemsSold += (s.sale_items?.length || 0); });
        document.getElementById('stat-items-sold').textContent = itemsSold;
      }

      // Terminal breakdown
      if (Auth.user?.role !== 'cashier') {
        await this.loadTerminalPerformance(todayStr);
      }

      // Cash session
      if (terminal) {
        await this.loadCashSession(terminal.id);
      } else {
        document.getElementById('cash-session-info').innerHTML = '<p class="text-sm text-muted">No terminal assigned</p>';
      }

      // Low stock
      await this.loadLowStock();

      // Top products
      const topRes = await Api.get(API.REPORTS.PRODUCTS);
      if (topRes.success) {
        this.renderTopProducts(topRes.data.products.slice(0, 5));
      }

    } catch (error) {
      console.error('Dashboard load error:', error);
    }
  },

  async loadTerminalPerformance(todayStr) {
    try {
      const terminalsRes = await Api.get(API.TERMINALS, { status: 'active' });
      if (!terminalsRes.success) return;

      const terminals = terminalsRes.data.terminals;
      const current = Auth.getTerminal();
      const breakdown = [];

      for (const t of terminals) {
        const res = await Api.get(API.REPORTS.SALES, { start_date: todayStr, terminal_id: t.id });
        if (res.success) {
          breakdown.push({
            terminal: t,
            sales: res.data.summary.total_sales,
            transactions: res.data.summary.total_transactions,
            isCurrent: current?.id === t.id
          });
        }
      }

      const container = document.getElementById('terminal-performance');
      if (!breakdown.length) {
        container.innerHTML = '<p class="text-sm text-muted">No terminal data</p>';
        return;
      }

      const maxSales = Math.max(...breakdown.map(b => b.sales), 1);

      container.innerHTML = `
        <div class="dash-terminal-list">
          ${breakdown.map(b => `
            <div class="dash-terminal-row ${b.isCurrent ? 'dash-terminal-current' : ''}">
              <div class="dash-terminal-code">
                ${b.isCurrent ? '<span class="terminal-dot"></span>' : ''}
                ${Utils.escapeHtml(b.terminal.terminal_code)}
              </div>
              <div class="dash-terminal-bar-track">
                <div class="dash-terminal-bar" style="width:${maxSales > 0 ? (b.sales / maxSales) * 100 : 0}%"></div>
              </div>
              <div class="dash-terminal-stats">
                <span class="dash-terminal-sales">${Utils.formatCurrency(b.sales)}</span>
                <span class="dash-terminal-txn">${b.transactions} txns</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (error) {
      console.error('Terminal performance error:', error);
    }
  },

  async loadCashSession(terminalId) {
    try {
      const res = await Api.get(API.CASH_SESSIONS, { terminal_id: terminalId, status: 'open' });
      const container = document.getElementById('cash-session-info');

      if (res.success && res.data.sessions?.length > 0) {
        const session = res.data.sessions[0];
        const openedAt = new Date(session.opened_at);
        const timeStr = openedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

        container.innerHTML = `
          <div class="dash-cash-session">
            <div class="dash-cash-session-header">
              <div class="dash-cash-session-terminal">
                <span class="terminal-dot"></span>
                ${Utils.escapeHtml(Auth.getTerminal()?.terminal_code || '')}
              </div>
              <span class="badge badge-success">Active</span>
            </div>
            <div class="dash-cash-session-detail">
              <span class="text-muted text-xs">Opened ${timeStr}</span>
            </div>
            <div class="dash-cash-session-rows">
              <div class="dash-cash-row">
                <span>Opening cash</span>
                <span class="font-semibold">${Utils.formatCurrency(session.opening_cash)}</span>
              </div>
              <div class="dash-cash-row">
                <span>Cash sales</span>
                <span class="font-semibold">${Utils.formatCurrency(session.expected_cash || 0)}</span>
              </div>
              <div class="dash-cash-row dash-cash-total">
                <span>Expected cash</span>
                <span class="font-bold">${Utils.formatCurrency((session.opening_cash || 0) + (session.expected_cash || 0))}</span>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm btn-full mt-sm" onclick="POSPage.closeCashSession && POSPage.closeCashSession()">Close Session</button>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="dash-cash-empty">
            <p class="text-sm text-muted mb-sm">No active session</p>
            <button class="btn btn-secondary btn-sm btn-full" onclick="Router.navigate('pos')">Open Session</button>
          </div>
        `;
      }
    } catch (error) {
      document.getElementById('cash-session-info').innerHTML = '<p class="text-sm text-muted">Unable to load session</p>';
    }
  },

  async loadLowStock() {
    try {
      const res = await Api.get(`${API.INVENTORY}/low-stock`);
      const container = document.getElementById('low-stock-list');

      if (res.success && res.data.products?.length > 0) {
        const products = res.data.products.slice(0, 6);
        container.innerHTML = `
          <div class="dash-low-stock">
            ${products.map(p => `
              <div class="dash-low-stock-item">
                <div class="dash-low-stock-name">${Utils.escapeHtml(p.name)}</div>
                <div class="dash-low-stock-qty">${p.stock_quantity} remaining</div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        container.innerHTML = '<p class="text-sm text-success">All products are well stocked</p>';
      }
    } catch (error) {
      document.getElementById('low-stock-list').innerHTML = '<p class="text-sm text-muted">Unable to load inventory</p>';
    }
  },

  renderRecentTransactions(sales) {
    const container = document.getElementById('recent-transactions');
    if (!sales.length) {
      container.innerHTML = '<p class="text-sm text-muted">No transactions today</p>';
      return;
    }

    container.innerHTML = `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Receipt</th>
              <th>Terminal</th>
              <th>Cashier</th>
              <th>Payment</th>
              <th class="text-right">Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${sales.map(s => `
              <tr>
                <td><strong>${s.receipt_number}</strong></td>
                <td>${s.terminals?.terminal_code || '—'}</td>
                <td>${s.users?.full_name || '—'}</td>
                <td>${Utils.getPaymentMethodName(s.payments?.[0]?.method)}</td>
                <td class="text-right font-semibold">${Utils.formatCurrency(s.total)}</td>
                <td><span class="badge ${Utils.getStatusBadgeClass(s.status)}">${Utils.capitalize(s.status)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderTopProducts(products) {
    const container = document.getElementById('top-products');
    if (!products.length) {
      container.innerHTML = '<p class="text-sm text-muted">No product data</p>';
      return;
    }

    container.innerHTML = `
      <div class="dash-top-products">
        ${products.map((p, i) => `
          <div class="dash-top-product">
            <div class="dash-top-rank">${i + 1}</div>
            <div class="dash-top-info">
              <div class="dash-top-name">${Utils.escapeHtml(p.product_name)}</div>
              <div class="dash-top-meta">${p.quantity_sold} sold</div>
            </div>
            <div class="dash-top-revenue">${Utils.formatCurrency(p.revenue)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }
};

Router.registerPage('dashboard', (container) => DashboardPage.render(container));
