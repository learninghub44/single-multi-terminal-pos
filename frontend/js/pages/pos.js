// POS Page
const POSPage = {
  cart: [],
  products: [],
  categories: [],
  customers: [],
  selectedCustomer: null,
  discount: 0,
  tax: 0,
  terminals: [],
  cashSession: null,
  isProcessing: false,

  async render(container) {
    // Check terminal assignment
    const terminal = Auth.getTerminal();
    if (!terminal) {
      await this.showTerminalSelection(container);
      return;
    }

    container.innerHTML = `
      <div class="pos-container">
        <!-- Products Panel -->
        <div class="pos-products">
          <div class="pos-header-bar">
            <div class="pos-terminal-info">
              <span class="badge badge-info">🖥️ ${Utils.escapeHtml(terminal.terminal_code)}</span>
              <span class="text-sm text-muted">${Utils.escapeHtml(terminal.name)}</span>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="POSPage.changeTerminal()">Change Terminal</button>
          </div>

          <div class="pos-search">
            <input type="text" id="pos-search-input" placeholder="Search or scan barcode..." autocomplete="off">
          </div>

          <div class="pos-categories" id="pos-categories">
            <button class="category-btn active" data-id="">All</button>
          </div>

          <div class="pos-products-grid" id="pos-products-grid">
            <div class="empty-state">
              <div class="spinner"></div>
            </div>
          </div>
        </div>

        <!-- Cart Panel -->
        <div class="pos-cart">
          <div class="cart-header">
            <span class="cart-title">Cart</span>
            <span class="cart-count" id="cart-count">0 items</span>
          </div>

          <div class="cart-customer">
            <select id="cart-customer">
              <option value="">Walk-in Customer</option>
            </select>
          </div>

          <!-- Cash Session Bar -->
          <div id="cash-session-bar" class="cash-session-bar">
            <div class="spinner"></div>
          </div>

          <div class="cart-items" id="cart-items">
            <div class="cart-empty">
              <p>Scan or select products</p>
            </div>
          </div>

          <div class="cart-summary">
            <div class="cart-summary-row">
              <span>Subtotal</span>
              <span id="cart-subtotal">KES 0.00</span>
            </div>
            <div class="cart-summary-row">
              <span>Discount</span>
              <span id="cart-discount-display">KES 0.00</span>
            </div>
            <div class="cart-summary-row">
              <span>Tax</span>
              <span id="cart-tax-display">KES 0.00</span>
            </div>
            <div class="cart-summary-row total">
              <span>Total</span>
              <span id="cart-total">KES 0.00</span>
            </div>
          </div>

          <div class="cart-payment">
            <button class="payment-btn cash" onclick="POSPage.checkout('cash')">
              <div class="payment-btn-icon">💵</div>
              <div class="payment-btn-label">Cash</div>
            </button>
            <button class="payment-btn mpesa" onclick="POSPage.checkout('mpesa')">
              <div class="payment-btn-icon">📱</div>
              <div class="payment-btn-label">M-Pesa</div>
            </button>
            <button class="payment-btn payhero" onclick="POSPage.checkout('payhero')">
              <div class="payment-btn-icon">💳</div>
              <div class="payment-btn-label">PayHero</div>
            </button>
            <button class="payment-btn manual" onclick="POSPage.checkout('manual')">
              <div class="payment-btn-icon">🧾</div>
              <div class="payment-btn-label">Till</div>
            </button>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
    this.setupEventListeners();
    this.setupBarcodeScanner();
    this.updateOfflinePaymentButtons();

    // Register once - render() can be called repeatedly (terminal switches,
    // navigation back to POS) and OfflineSync keeps listeners for the whole
    // page lifetime, so re-registering every render would stack duplicate
    // handlers.
    if (!this._offlineListenerRegistered) {
      OfflineSync.onStatusChange(() => this.updateOfflinePaymentButtons());
      this._offlineListenerRegistered = true;
    }
  },

  async showTerminalSelection(container) {
    try {
      const response = await Api.get(API.TERMINALS, { status: 'active' });
      if (response.success) {
        this.terminals = response.data.terminals;
      }
    } catch (error) {
      Toast.show('Failed to load terminals', 'error');
      return;
    }

    container.innerHTML = `
      <div class="terminal-selection">
        <div class="card" style="max-width: 500px; margin: 40px auto;">
          <div class="card-header">
            <h3 class="card-title">Select Terminal</h3>
          </div>
          <p class="text-muted mb-lg">Choose the POS terminal you are working on:</p>
          <div id="terminal-list">
            ${this.terminals.length ? this.terminals.map(t => `
              <button class="terminal-select-btn" onclick="POSPage.selectTerminal('${t.id}')">
                <div class="terminal-select-code">${Utils.escapeHtml(t.terminal_code)}</div>
                <div class="terminal-select-name">${Utils.escapeHtml(t.name)}</div>
                ${t.location ? `<div class="terminal-select-location">${Utils.escapeHtml(t.location)}</div>` : ''}
              </button>
            `).join('') : '<p class="text-muted text-center">No active terminals found. Please create a terminal first.</p>'}
          </div>
        </div>
      </div>
    `;
  },

  async selectTerminal(terminalId) {
    const terminal = this.terminals.find(t => t.id === terminalId);
    if (!terminal) return;

    Auth.setTerminal(terminal);
    Toast.show(`Terminal ${terminal.terminal_code} selected`, 'success');

    // Re-render POS with terminal
    const container = document.getElementById('page-container');
    await this.render(container);
  },

  changeTerminal() {
    Auth.clearTerminal();
    const container = document.getElementById('page-container');
    this.render(container);
  },

  async loadData() {
    const terminal = Auth.getTerminal();

    if (!OfflineSync.isOnline()) {
      await this.loadFromCache();
      // Cash session state can't be verified without a network round trip -
      // keep whatever was last loaded in memory (set on the last successful
      // online load) rather than guessing.
      this.renderCashSessionBar();
      this.updateOfflinePaymentButtons();
      return;
    }

    try {
      const [productsRes, categoriesRes, customersRes, settingsRes] = await Promise.all([
        Api.get(API.PRODUCTS, { limit: 100, status: 'active' }),
        Api.get(API.CATEGORIES),
        Api.get(API.CUSTOMERS, { limit: 100 }),
        Api.get(API.SETTINGS)
      ]);

      if (productsRes.success) {
        this.products = productsRes.data.products;
        this.renderProducts();
        OfflineStore.cacheProducts(this.products).catch(err => console.error('Product cache error:', err));
      }

      if (categoriesRes.success) {
        this.categories = categoriesRes.data.categories;
        this.renderCategories();
        OfflineStore.cacheCategories(this.categories).catch(err => console.error('Category cache error:', err));
      }

      if (customersRes.success) {
        this.customers = customersRes.data.customers;
        this.renderCustomers();
      }

      if (settingsRes.success) {
        this.businessSettings = settingsRes.data;
      }

      // Load cash session for this terminal
      if (terminal) {
        await this.loadCashSession(terminal.id);
      }
    } catch (error) {
      console.error('POS data load error:', error);
      // Network request itself failed (e.g. connection dropped mid-load) -
      // fall back to whatever was cached from the last successful load
      // rather than leaving the screen empty.
      Toast.show('Connection lost - showing cached products', 'warning');
      await this.loadFromCache();
    }

    this.updateOfflinePaymentButtons();
  },

  async loadFromCache() {
    try {
      const [products, categories] = await Promise.all([
        OfflineStore.getCachedProducts(),
        OfflineStore.getCachedCategories()
      ]);
      this.products = products;
      this.categories = categories;
      this.renderProducts();
      this.renderCategories();

      if (!products.length) {
        Toast.show('No cached products yet - connect to the internet at least once first', 'warning');
      }
    } catch (error) {
      console.error('Failed to load from offline cache:', error);
    }
  },

  updateOfflinePaymentButtons() {
    const online = OfflineSync.isOnline();
    ['mpesa', 'payhero', 'manual'].forEach((method) => {
      const btn = document.querySelector(`.payment-btn.${method}`);
      if (!btn) return;
      btn.disabled = !online;
      btn.title = online ? '' : 'Needs an internet connection';
    });
  },

  async loadCashSession(terminalId) {
    try {
      const response = await Api.get(`${API.CASH_SESSIONS}/active/${terminalId}`);
      if (response.success && response.data.session) {
        this.cashSession = response.data.session;
        this.renderCashSessionBar();
      } else {
        this.cashSession = null;
        this.renderCashSessionBar();
      }
    } catch (error) {
      console.error('Failed to load cash session:', error);
      this.cashSession = null;
      this.renderCashSessionBar();
    }
  },

  renderCashSessionBar() {
    const container = document.getElementById('cash-session-bar');
    if (!container) return;

    if (this.cashSession) {
      container.innerHTML = `
        <div class="cash-session-active">
          <div class="cash-session-info">
            <span class="badge badge-success">Shift Open</span>
            <span class="text-sm">Opening: ${Utils.formatCurrency(this.cashSession.opening_cash)}</span>
          </div>
          <button class="btn btn-danger btn-sm" onclick="POSPage.closeCashSession()">End Shift</button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="cash-session-closed">
          <p class="text-sm text-muted mb-sm">No active shift</p>
          <button class="btn btn-primary btn-sm" onclick="POSPage.openCashSession()">Open Shift</button>
        </div>
      `;
    }
  },

  openCashSession() {
    const content = `
      <div class="form-group">
        <label for="opening-cash">Opening Cash</label>
        <input type="number" id="opening-cash" class="form-input" value="0" min="0" step="0.01">
        <div class="form-hint">Enter the amount of cash in the drawer at the start of shift</div>
      </div>
    `;

    Modal.show('Open Shift', content, {
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="POSPage.processOpenCashSession()">Open Shift</button>
      `
    });
  },

  async processOpenCashSession() {
    const terminal = Auth.getTerminal();
    if (!terminal) {
      Toast.show('No terminal selected', 'error');
      return;
    }

    const openingCash = parseFloat(document.getElementById('opening-cash').value) || 0;

    try {
      const response = await Api.post(`${API.CASH_SESSIONS}/open`, {
        terminal_id: terminal.id,
        opening_cash: openingCash
      });

      if (response.success) {
        Modal.close();
        this.cashSession = response.data;
        this.renderCashSessionBar();
        Toast.show('Shift opened successfully', 'success');
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to open shift', 'error');
    }
  },

  closeCashSession() {
    const content = `
      <div class="checkout-summary">
        <div class="mb-md">
          <strong>Opening Cash:</strong> ${Utils.formatCurrency(this.cashSession?.opening_cash || 0)}
        </div>
      </div>
      <div class="form-group">
        <label for="actual-cash">Actual Cash in Drawer</label>
        <input type="number" id="actual-cash" class="form-input" value="0" min="0" step="0.01">
        <div class="form-hint">Count the cash in the drawer and enter the total</div>
      </div>
    `;

    Modal.show('End Shift', content, {
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-danger" onclick="POSPage.processCloseCashSession()">End Shift</button>
      `
    });
  },

  async processCloseCashSession() {
    if (!this.cashSession) return;

    const actualCash = parseFloat(document.getElementById('actual-cash').value) || 0;

    try {
      const response = await Api.post(`${API.CASH_SESSIONS}/close`, {
        session_id: this.cashSession.id,
        actual_cash: actualCash
      });

      if (response.success) {
        const session = response.data;
        const diff = session.difference || 0;
        const diffText = diff >= 0 ? `+${Utils.formatCurrency(diff)}` : Utils.formatCurrency(diff);

        Modal.close();
        Toast.show(`Shift ended. Difference: ${diffText}`, diff >= 0 ? 'success' : 'warning');

        this.cashSession = null;
        this.renderCashSessionBar();
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to close shift', 'error');
    }
  },

  renderCategories() {
    const container = document.getElementById('pos-categories');
    container.innerHTML = `
      <button class="category-btn active" data-id="">All</button>
      ${this.categories.map(cat => `
        <button class="category-btn" data-id="${cat.id}">${Utils.escapeHtml(cat.name)}</button>
      `).join('')}
    `;

    container.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filterProducts(btn.dataset.id);
      });
    });
  },

  renderProducts(categoryId = '') {
    const container = document.getElementById('pos-products-grid');
    let filtered = this.products;

    if (categoryId) {
      filtered = filtered.filter(p => p.category_id === categoryId);
    }

    if (!filtered.length) {
      container.innerHTML = '<div class="empty-state"><p>No products found</p></div>';
      return;
    }

    container.innerHTML = filtered.map(product => `
      <div class="product-card" onclick="POSPage.addToCart('${product.id}')">
        <div class="product-card-image">📦</div>
        <div class="product-card-name" title="${Utils.escapeHtml(product.name)}">${Utils.escapeHtml(Utils.truncate(product.name, 20))}</div>
        <div class="product-card-price">${Utils.formatCurrency(product.selling_price)}</div>
        <div class="product-card-stock ${product.stock_quantity <= product.low_stock_threshold ? 'low' : ''}">
          Stock: ${product.stock_quantity}
        </div>
      </div>
    `).join('');
  },

  filterProducts(categoryId) {
    this.renderProducts(categoryId);
  },

  renderCustomers() {
    const select = document.getElementById('cart-customer');
    select.innerHTML = `
      <option value="">Walk-in Customer</option>
      ${this.customers.map(c => `
        <option value="${c.id}">${Utils.escapeHtml(c.name)}</option>
      `).join('')}
    `;
  },

  setupEventListeners() {
    const searchInput = document.getElementById('pos-search-input');
    searchInput.addEventListener('input', Utils.debounce((e) => {
      this.searchProducts(e.target.value);
    }, 300));

    // Barcode scanners are keyboard-wedge devices: they "type" the code into
    // whatever has focus and then send Enter (sometimes Tab). If the search
    // box has focus - the common case, since it's the first thing on the
    // page - BarcodeScanner's global listener below ignores it (it skips
    // INPUT/TEXTAREA targets to avoid interfering with normal typing), so a
    // scan would otherwise just sit in the search box as a filter with
    // nothing added to the cart. This catches that case directly.
    searchInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const value = searchInput.value.trim();
      if (!value) return;

      const exactMatch = this.products.find(p => p.barcode === value || p.sku === value);
      if (exactMatch) {
        e.preventDefault();
        this.addToCart(exactMatch.id);
        searchInput.value = '';
        this.searchProducts('');
      }
    });

    document.getElementById('cart-customer').addEventListener('change', (e) => {
      this.selectedCustomer = e.target.value || null;
    });
  },

  setupBarcodeScanner() {
    BarcodeScanner.init((barcode) => {
      this.addToCartByBarcode(barcode);
    });
  },

  searchProducts(query) {
    if (!query) {
      this.renderProducts();
      return;
    }

    const filtered = this.products.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(query.toLowerCase())) ||
      (p.barcode && p.barcode.includes(query))
    );

    const container = document.getElementById('pos-products-grid');
    if (!filtered.length) {
      container.innerHTML = '<div class="empty-state"><p>No products found</p></div>';
      return;
    }

    container.innerHTML = filtered.map(product => `
      <div class="product-card" onclick="POSPage.addToCart('${product.id}')">
        <div class="product-card-image">📦</div>
        <div class="product-card-name" title="${Utils.escapeHtml(product.name)}">${Utils.escapeHtml(Utils.truncate(product.name, 20))}</div>
        <div class="product-card-price">${Utils.formatCurrency(product.selling_price)}</div>
        <div class="product-card-stock ${product.stock_quantity <= product.low_stock_threshold ? 'low' : ''}">
          Stock: ${product.stock_quantity}
        </div>
      </div>
    `).join('');
  },

  addToCart(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) {
      Toast.show('Product not found', 'error');
      return;
    }

    if (product.stock_quantity <= 0) {
      Toast.show('Product out of stock', 'error');
      return;
    }

    const existing = this.cart.find(item => item.product_id === productId);
    if (existing) {
      if (existing.quantity >= product.stock_quantity) {
        Toast.show('Insufficient stock', 'error');
        return;
      }
      existing.quantity++;
      existing.subtotal = existing.quantity * existing.unit_price;
    } else {
      this.cart.push({
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: parseFloat(product.selling_price),
        buying_price: parseFloat(product.buying_price),
        subtotal: parseFloat(product.selling_price)
      });
    }

    this.updateCart();
    Toast.show(`${product.name} added to cart`, 'success');
  },

  addToCartByBarcode(barcode) {
    const product = this.products.find(p => p.barcode === barcode);
    if (product) {
      this.addToCart(product.id);
    } else {
      Toast.show('Product not found', 'warning');
    }
  },

  updateQuantity(index, delta) {
    const item = this.cart[index];
    if (!item) return;

    const product = this.products.find(p => p.id === item.product_id);
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      this.removeFromCart(index);
      return;
    }

    if (product && newQty > product.stock_quantity) {
      Toast.show('Insufficient stock', 'error');
      return;
    }

    item.quantity = newQty;
    item.subtotal = newQty * item.unit_price;
    this.updateCart();
  },

  removeFromCart(index) {
    this.cart.splice(index, 1);
    this.updateCart();
  },

  clearCart() {
    this.cart = [];
    this.discount = 0;
    this.tax = 0;
    this.selectedCustomer = null;
    document.getElementById('cart-customer').value = '';
    this.updateCart();
  },

  updateCart() {
    const container = document.getElementById('cart-items');
    const countEl = document.getElementById('cart-count');

    countEl.textContent = `${this.cart.length} item${this.cart.length !== 1 ? 's' : ''}`;

    if (!this.cart.length) {
      container.innerHTML = '<div class="cart-empty"><p>Scan or select products</p></div>';
      this.updateTotals();
      return;
    }

    container.innerHTML = this.cart.map((item, index) => `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${Utils.escapeHtml(item.product_name)}</div>
          <div class="cart-item-price">${Utils.formatCurrency(item.unit_price)} each</div>
        </div>
        <div class="cart-item-controls">
          <button class="btn btn-ghost btn-sm" onclick="POSPage.updateQuantity(${index}, -1)">-</button>
          <input type="number" class="cart-item-qty" value="${item.quantity}" onchange="POSPage.setQuantity(${index}, this.value)">
          <button class="btn btn-ghost btn-sm" onclick="POSPage.updateQuantity(${index}, 1)">+</button>
        </div>
        <div class="cart-item-subtotal">${Utils.formatCurrency(item.subtotal)}</div>
        <button class="cart-item-remove" onclick="POSPage.removeFromCart(${index})">×</button>
      </div>
    `).join('');

    this.updateTotals();
  },

  setQuantity(index, value) {
    const qty = parseInt(value);
    if (isNaN(qty) || qty <= 0) {
      this.removeFromCart(index);
      return;
    }

    const item = this.cart[index];
    const product = this.products.find(p => p.id === item.product_id);

    if (product && qty > product.stock_quantity) {
      Toast.show('Insufficient stock', 'error');
      return;
    }

    item.quantity = qty;
    item.subtotal = qty * item.unit_price;
    this.updateCart();
  },

  updateTotals() {
    const subtotal = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
    const total = subtotal - this.discount + this.tax;

    document.getElementById('cart-subtotal').textContent = Utils.formatCurrency(subtotal);
    document.getElementById('cart-discount-display').textContent = Utils.formatCurrency(this.discount);
    document.getElementById('cart-tax-display').textContent = Utils.formatCurrency(this.tax);
    document.getElementById('cart-total').textContent = Utils.formatCurrency(total);
  },

  async checkout(method) {
    if (this.isProcessing) {
      Toast.show('Processing previous transaction...', 'warning');
      return;
    }

    if (!this.cart.length) {
      Toast.show('Cart is empty', 'warning');
      return;
    }

    // Check terminal is assigned
    const terminal = Auth.getTerminal();
    if (!terminal) {
      Toast.show('Please select a terminal first', 'error');
      return;
    }

    // For cash payments, check cash session
    if (method === 'cash' && !this.cashSession) {
      Toast.show('Please open a cash shift first', 'error');
      return;
    }

    if (method !== 'cash' && !OfflineSync.isOnline()) {
      Toast.show(`${Utils.getPaymentMethodName(method)} needs an internet connection. Use Cash while offline.`, 'error');
      return;
    }

    const subtotal = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
    const total = subtotal - this.discount + this.tax;

    if (method === 'cash') {
      this.showCashCheckout(total);
    } else if (method === 'mpesa') {
      this.showMpesaCheckout(total);
    } else if (method === 'payhero') {
      this.showPayHeroCheckout(total);
    } else if (method === 'manual') {
      this.showManualCheckout(total);
    }
  },

  showCashCheckout(total) {
    const content = `
      <div class="checkout-summary">
        <div class="checkout-total">${Utils.formatCurrency(total)}</div>
      </div>
      <div class="form-group">
        <label for="amount-received">Amount Received</label>
        <input type="number" id="amount-received" class="checkout-input" value="${Math.ceil(total)}" min="${total}">
      </div>
      <div class="checkout-change" id="checkout-change">
        Change: ${Utils.formatCurrency(Math.ceil(total) - total)}
      </div>
    `;

    Modal.show('Cash Payment', content, {
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-success" onclick="POSPage.processCashPayment()">Complete Sale</button>
      `
    });

    document.getElementById('amount-received').addEventListener('input', (e) => {
      const received = parseFloat(e.target.value) || 0;
      const change = received - total;
      const changeEl = document.getElementById('checkout-change');
      changeEl.textContent = `Change: ${Utils.formatCurrency(change)}`;
      changeEl.className = `checkout-change ${change >= 0 ? 'positive' : ''}`;
    });
  },

  async processCashPayment() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const amountReceived = parseFloat(document.getElementById('amount-received').value);
    const subtotal = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
    const total = subtotal - this.discount + this.tax;
    const terminal = Auth.getTerminal();

    if (amountReceived < total) {
      Toast.show('Insufficient amount received', 'error');
      this.isProcessing = false;
      return;
    }

    const salePayload = {
      items: this.cart,
      customer_id: this.selectedCustomer,
      discount: this.discount,
      tax: this.tax,
      payment_method: 'cash',
      terminal_id: terminal?.id,
      cash_session_id: this.cashSession?.id,
      payment_details: { amount_received: amountReceived }
    };

    // Offline: skip the network call entirely and queue locally. Cash is the
    // only method that can complete without a round trip - the cashier has
    // the money in hand, there's nothing left to confirm.
    if (!OfflineSync.isOnline()) {
      try {
        const queued = await OfflineStore.queueSale(salePayload);
        this.lastSaleSnapshot = { items: [...this.cart], total };
        Modal.close();
        Toast.show('Offline sale saved - will sync when back online', 'warning');
        this.showReceipt(queued.local_receipt_number, amountReceived - total, true);
        this.clearCart();
        await this.loadFromCache();
        OfflineSync.notify();
      } catch (error) {
        console.error('Failed to queue offline sale:', error);
        Toast.show('Failed to save offline sale', 'error');
      } finally {
        this.isProcessing = false;
      }
      return;
    }

    try {
      const response = await Api.post(API.SALES, salePayload);

      if (response.success) {
        Modal.close();
        Toast.show('Sale completed successfully', 'success');

        // Show receipt
        this.showReceipt(response.data.sale.receipt_number, amountReceived - total);

        // Clear cart
        this.clearCart();

        // Reload products for stock update
        await this.loadData();
      }
    } catch (error) {
      // The request itself failed (connection dropped between the online
      // check above and now) - don't lose the sale, queue it offline instead.
      if (!navigator.onLine) {
        try {
          const queued = await OfflineStore.queueSale(salePayload);
          this.lastSaleSnapshot = { items: [...this.cart], total };
          Modal.close();
          Toast.show('Connection lost - sale saved offline and will sync later', 'warning');
          this.showReceipt(queued.local_receipt_number, amountReceived - total, true);
          this.clearCart();
          await this.loadFromCache();
          OfflineSync.notify();
        } catch (queueError) {
          console.error('Failed to queue offline sale:', queueError);
          Toast.show('Failed to process payment', 'error');
        }
      } else {
        Toast.show(error.message || 'Failed to process payment', 'error');
      }
    } finally {
      this.isProcessing = false;
    }
  },

  showMpesaCheckout(total) {
    const content = `
      <div class="checkout-summary">
        <div class="checkout-total">${Utils.formatCurrency(total)}</div>
      </div>
      <div class="form-group">
        <label for="mpesa-phone">Phone Number</label>
        <div class="phone-input">
          <span class="phone-prefix">+254</span>
          <input type="tel" id="mpesa-phone" class="form-input" placeholder="7XXXXXXXX" pattern="[0-9]{9}">
        </div>
      </div>
    `;

    Modal.show('M-Pesa Payment', content, {
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-warning" onclick="POSPage.processMpesaPayment()">Send STK Push</button>
      `
    });
  },

  async processMpesaPayment() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const phone = document.getElementById('mpesa-phone').value;
    const subtotal = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
    const total = subtotal - this.discount + this.tax;
    const terminal = Auth.getTerminal();

    if (!phone || phone.length < 9) {
      Toast.show('Please enter a valid phone number', 'error');
      this.isProcessing = false;
      return;
    }

    try {
      // First create the sale
      const saleResponse = await Api.post(API.SALES, {
        items: this.cart,
        customer_id: this.selectedCustomer,
        discount: this.discount,
        tax: this.tax,
        payment_method: 'mpesa',
        terminal_id: terminal?.id,
        cash_session_id: this.cashSession?.id,
        payment_details: { phone: `254${phone}` }
      });

      if (!saleResponse.success) {
        throw new Error(saleResponse.error?.message);
      }

      // Initiate M-Pesa payment
      const paymentResponse = await Api.post(API.PAYMENTS.MPEZA_INITIATE, {
        sale_id: saleResponse.data.sale.id,
        phone: `254${phone}`,
        amount: total
      });

      if (paymentResponse.success) {
        Modal.close();
        this.showPendingPayment(saleResponse.data.sale, saleResponse.data.payment, 'mpesa');
      } else {
        await this.cancelOrphanedSale(saleResponse.data.payment?.id);
        throw new Error(paymentResponse.error?.message || 'Failed to initiate M-Pesa payment');
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to initiate M-Pesa payment', 'error');
    } finally {
      this.isProcessing = false;
    }
  },

  showPayHeroCheckout(total) {
    const content = `
      <div class="checkout-summary">
        <div class="checkout-total">${Utils.formatCurrency(total)}</div>
      </div>
      <div class="form-group">
        <label for="payhero-phone">Phone Number</label>
        <div class="phone-input">
          <span class="phone-prefix">+254</span>
          <input type="tel" id="payhero-phone" class="form-input" placeholder="7XXXXXXXX" pattern="[0-9]{9}">
        </div>
      </div>
    `;

    Modal.show('PayHero Payment', content, {
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-info" onclick="POSPage.processPayHeroPayment()">Send Payment Request</button>
      `
    });
  },

  async processPayHeroPayment() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const phone = document.getElementById('payhero-phone').value;
    const subtotal = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
    const total = subtotal - this.discount + this.tax;
    const terminal = Auth.getTerminal();

    if (!phone || phone.length < 9) {
      Toast.show('Please enter a valid phone number', 'error');
      this.isProcessing = false;
      return;
    }

    try {
      // Create sale
      const saleResponse = await Api.post(API.SALES, {
        items: this.cart,
        customer_id: this.selectedCustomer,
        discount: this.discount,
        tax: this.tax,
        payment_method: 'payhero',
        terminal_id: terminal?.id,
        cash_session_id: this.cashSession?.id,
        payment_details: { phone: `254${phone}` }
      });

      if (!saleResponse.success) {
        throw new Error(saleResponse.error?.message);
      }

      // Initiate PayHero payment
      const paymentResponse = await Api.post(API.PAYMENTS.PAYHERO_INITIATE, {
        sale_id: saleResponse.data.sale.id,
        phone: `254${phone}`,
        amount: total
      });

      if (paymentResponse.success) {
        Modal.close();
        this.showPendingPayment(saleResponse.data.sale, saleResponse.data.payment, 'payhero');
      } else {
        // Initiation failed after the sale (and its stock deduction) was
        // already created - cancel it so stock isn't stuck reserved forever.
        await this.cancelOrphanedSale(saleResponse.data.payment?.id);
        throw new Error(paymentResponse.error?.message || 'Failed to initiate PayHero payment');
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to initiate PayHero payment', 'error');
    } finally {
      this.isProcessing = false;
    }
  },

  // Cancels a just-created pending payment/sale and restores its stock.
  // Used when a mobile-money initiate call fails right after sale creation.
  async cancelOrphanedSale(paymentId) {
    if (!paymentId) return;
    try {
      await Api.post(API.PAYMENTS.CANCEL(paymentId), {});
    } catch (err) {
      console.error('Failed to cancel orphaned sale:', err);
    }
  },

  showManualCheckout(total) {
    const s = this.businessSettings || {};
    const hasConfiguredDetails = s.till_number || s.paybill_number || s.manual_payment_instructions;

    // Build the "pay to" block from whatever was configured in Settings
    // (Settings > Manual Payment) so the cashier never has to remember or
    // type the till/paybill number from memory.
    let payToHtml = '';
    if (s.till_number) {
      payToHtml += `<div class="manual-payment-detail"><span>Till Number</span><strong>${Utils.escapeHtml(s.till_number)}</strong></div>`;
    }
    if (s.paybill_number) {
      payToHtml += `<div class="manual-payment-detail"><span>Paybill Number</span><strong>${Utils.escapeHtml(s.paybill_number)}</strong></div>`;
    }
    if (s.paybill_account_name) {
      payToHtml += `<div class="manual-payment-detail"><span>Account</span><strong>${Utils.escapeHtml(s.paybill_account_name)}</strong></div>`;
    }
    if (s.manual_payment_instructions) {
      payToHtml += `<div class="manual-payment-detail"><span>Note</span><strong>${Utils.escapeHtml(s.manual_payment_instructions)}</strong></div>`;
    }

    const content = `
      <div class="checkout-summary">
        <div class="checkout-total">${Utils.formatCurrency(total)}</div>
      </div>
      <div class="manual-payment-instructions">
        ${hasConfiguredDetails
          ? `<p>Ask the customer to pay <strong>${Utils.formatCurrency(total)}</strong> using the details below, then confirm once you've seen the M-Pesa message on your phone.</p>
             <div class="manual-payment-details">${payToHtml}</div>`
          : `<p>Ask the customer to pay <strong>${Utils.formatCurrency(total)}</strong> to your Till/Paybill number, then confirm below once you've seen the M-Pesa message on your phone.</p>
             <p class="text-sm text-muted">Tip: add your till/paybill number in Settings so it shows here automatically next time.</p>`
        }
      </div>
      <div class="form-group">
        <label for="manual-till-ref">Till/Paybill Reference (optional)</label>
        <input type="text" id="manual-till-ref" class="form-input" placeholder="e.g. account name or till number used" value="${Utils.escapeHtml(s.paybill_account_name || s.till_number || s.paybill_number || '')}">
      </div>
      <div class="form-group">
        <label for="manual-confirmation-code">M-Pesa Confirmation Code</label>
        <input type="text" id="manual-confirmation-code" class="form-input" placeholder="e.g. SAE3YULR0Y" style="text-transform: uppercase;" autocomplete="off">
        <div class="form-hint">Copy the code from the confirmation SMS - this is your proof of payment.</div>
      </div>
    `;

    Modal.show('Till Payment (Manual)', content, {
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-success" onclick="POSPage.processManualPayment()">Confirm Payment Received</button>
      `
    });
  },

  async processManualPayment() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const tillRef = document.getElementById('manual-till-ref').value.trim();
    const confirmationCode = document.getElementById('manual-confirmation-code').value.trim();
    const terminal = Auth.getTerminal();

    if (!confirmationCode) {
      Toast.show('Enter the M-Pesa confirmation code before confirming', 'error');
      this.isProcessing = false;
      return;
    }

    let saleResponse;
    try {
      saleResponse = await Api.post(API.SALES, {
        items: this.cart,
        customer_id: this.selectedCustomer,
        discount: this.discount,
        tax: this.tax,
        payment_method: 'manual',
        terminal_id: terminal?.id,
        cash_session_id: this.cashSession?.id,
        payment_details: {}
      });

      if (!saleResponse.success) {
        throw new Error(saleResponse.error?.message);
      }

      const confirmResponse = await Api.post(API.PAYMENTS.MANUAL_INITIATE, {
        sale_id: saleResponse.data.sale.id,
        till_reference: tillRef || null,
        confirmation_code: confirmationCode
      });

      if (!confirmResponse.success) {
        await this.cancelOrphanedSale(saleResponse.data.payment?.id);
        throw new Error(confirmResponse.error?.message || 'Failed to confirm payment');
      }

      Modal.close();
      Toast.show('Sale completed successfully', 'success');
      this.showReceipt(saleResponse.data.sale.receipt_number);
      this.clearCart();
      await this.loadData();
    } catch (error) {
      Toast.show(error.message || 'Failed to process till payment', 'error');
    } finally {
      this.isProcessing = false;
    }
  },

  showPendingPayment(sale, payment, method) {
    const methodName = Utils.getPaymentMethodName(method);
    const content = `
      <div class="pending-payment">
        <div class="pending-spinner"></div>
        <div class="pending-title">Waiting for ${methodName} Payment</div>
        <div class="pending-message">
          Please complete the payment on your phone.<br>
          Amount: ${Utils.formatCurrency(sale.total)}
        </div>
      </div>
    `;

    Modal.show(`${methodName} Payment Pending`, content, {
      footer: payment?.id ? `
        <button class="btn btn-secondary" onclick="POSPage.cancelPendingPayment('${payment.id}')">Cancel Payment</button>
      ` : ''
    });

    // Poll for payment status
    this.pollPaymentStatus(sale.id, payment?.id);
  },

  async cancelPendingPayment(paymentId) {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.pollCancelled = true;

    try {
      if (paymentId) {
        await Api.post(API.PAYMENTS.CANCEL(paymentId), {});
      }
      Modal.close();
      Toast.show('Payment cancelled. Stock has been restored.', 'info');
      await this.loadData();
    } catch (error) {
      Toast.show(error.message || 'Failed to cancel payment', 'error');
    } finally {
      this.isProcessing = false;
    }
  },

  async pollPaymentStatus(saleId, paymentId) {
    const maxAttempts = 36; // 3 minutes with 5 second intervals, matches server-side expiry
    let attempts = 0;
    this.pollCancelled = false;

    const poll = async () => {
      if (this.pollCancelled) {
        return;
      }

      if (attempts >= maxAttempts) {
        // Ask the backend to resolve/expire it (it auto-cancels + restocks
        // once past expires_at) rather than just giving up client-side.
        if (paymentId) {
          try {
            await Api.get(API.PAYMENTS.STATUS(paymentId));
          } catch (err) {
            console.error('Final status check error:', err);
          }
        }
        Modal.close();
        Toast.show('Payment timed out and was cancelled. Stock has been restored.', 'warning');
        await this.loadData();
        return;
      }

      try {
        // Hitting the payment status endpoint (not just the sale) makes the
        // backend actively poll the provider and resolve stuck payments,
        // rather than passively waiting on the webhook alone.
        if (paymentId) {
          const statusResponse = await Api.get(API.PAYMENTS.STATUS(paymentId));
          if (statusResponse.success) {
            const status = statusResponse.data.status;
            if (status === 'paid') {
              Modal.close();
              Toast.show('Payment received!', 'success');
              const saleResponse = await Api.get(API.SALES + '/' + saleId);
              this.showReceipt(saleResponse.success ? saleResponse.data.receipt_number : '');
              this.clearCart();
              await this.loadData();
              return;
            }
            if (status === 'failed' || status === 'cancelled' || status === 'expired') {
              Modal.close();
              Toast.show('Payment was not completed. Stock has been restored.', 'warning');
              await this.loadData();
              return;
            }
          }
        } else {
          const response = await Api.get(API.SALES + '/' + saleId);
          if (response.success && response.data.status === 'completed') {
            Modal.close();
            Toast.show('Payment received!', 'success');
            this.showReceipt(response.data.receipt_number);
            this.clearCart();
            await this.loadData();
            return;
          }
        }
      } catch (error) {
        console.error('Poll error:', error);
      }

      attempts++;
      setTimeout(poll, 5000);
    };

    poll();
  },

  async showReceipt(receiptNumber, change = 0, isOffline = false) {
    const terminal = Auth.getTerminal();
    const content = `
      <div style="text-align: center; padding: 20px;">
        <h3>${isOffline ? 'Sale Saved (Offline)' : 'Sale Completed!'}</h3>
        <p>Receipt: <strong>${receiptNumber}</strong></p>
        ${terminal ? `<p>Terminal: <strong>${terminal.terminal_code}</strong></p>` : ''}
        ${change > 0 ? `<p>Change: <strong>${Utils.formatCurrency(change)}</strong></p>` : ''}
        ${isOffline ? '<p class="text-sm text-muted">This will get a real receipt number once it syncs. The printed copy below is a temporary copy for the customer.</p>' : ''}
      </div>
    `;

    Modal.show(isOffline ? 'Offline Sale Saved' : 'Sale Complete', content, {
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Close</button>
        <button class="btn btn-primary" onclick="POSPage.printReceipt('${receiptNumber}', ${isOffline})">Print Receipt</button>
      `
    });
  },

  async printReceipt(receiptNumber, isOffline = false) {
    if (isOffline) {
      this.printOfflineReceipt(receiptNumber);
      return;
    }

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
  },

  // Server can't generate a receipt for a sale it hasn't seen yet, so this
  // builds a minimal printable copy from the snapshot taken right before the
  // cart was cleared (see processCashPayment). Kept visually close to the
  // server template (receipts.ts) so a cashier can't tell the two apart at a
  // glance except for the OFFLINE tag.
  printOfflineReceipt(receiptNumber) {
    const terminal = Auth.getTerminal();
    const snapshot = this.lastSaleSnapshot || { items: [], total: 0 };
    const date = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
    const businessName = this.businessSettings?.business_name || 'POS Store';

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Receipt ${receiptNumber}</title>
<style>
  @page { size: 80mm auto; margin: 2mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 80mm; padding: 2mm; background: white; color: black; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .line { border-top: 1px dashed #000; margin: 2mm 0; }
  .item { display: flex; justify-content: space-between; margin: 1mm 0; }
  .total-row { display: flex; justify-content: space-between; margin: 1mm 0; }
  .offline-tag { border: 1px solid #000; padding: 1mm; text-align: center; margin: 2mm 0; }
</style>
</head>
<body>
  <div class="center">
    <div class="bold" style="font-size: 14px;">${Utils.escapeHtml(businessName)}</div>
  </div>
  <div class="line"></div>
  <div class="offline-tag bold">OFFLINE SALE - PENDING SYNC</div>
  <div>
    <div class="bold">RECEIPT ${Utils.escapeHtml(receiptNumber)}</div>
    <div>Date: ${date}</div>
    ${terminal ? `<div>Terminal: ${Utils.escapeHtml(terminal.terminal_code)}</div>` : ''}
  </div>
  <div class="line"></div>
  ${snapshot.items.map(item => `
    <div class="item">
      <span>${Utils.escapeHtml(item.product_name)} x${item.quantity}</span>
      <span>${Utils.formatCurrency(item.subtotal)}</span>
    </div>
  `).join('')}
  <div class="line"></div>
  <div class="total-row bold">
    <span>TOTAL</span>
    <span>${Utils.formatCurrency(snapshot.total)}</span>
  </div>
  <div class="line"></div>
  <div class="center">This copy is temporary - final receipt<br>number is issued once synced online.</div>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

Router.registerPage('pos', (container) => POSPage.render(container));
