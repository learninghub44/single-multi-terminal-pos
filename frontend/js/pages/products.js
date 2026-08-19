// Products Page
const ProductsPage = {
  products: [],
  categories: [],
  currentPage: 1,
  totalPages: 1,
  search: '',

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Products</h1>
        <button class="btn btn-primary" onclick="ProductsPage.showAddModal()">+ Add Product</button>
      </div>

      <div class="card">
        <div class="filters-bar">
          <div class="search-input">
            <input type="text" id="products-search" class="form-input" placeholder="Search products...">
          </div>
          <select id="products-category" class="form-select">
            <option value="">All Categories</option>
          </select>
          <select id="products-status" class="form-select">
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Barcode</th>
                <th>Category</th>
                <th>Buying Price</th>
                <th>Selling Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="products-table-body">
              <tr><td colspan="9" class="text-center"><div class="spinner"></div></td></tr>
            </tbody>
          </table>
        </div>

        <div id="products-pagination" class="pagination"></div>
      </div>
    `;

    await this.loadData();
    this.setupEventListeners();
  },

  async loadData() {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        Api.get(API.PRODUCTS, {
          page: this.currentPage,
          limit: 20,
          search: this.search,
          status: document.getElementById('products-status')?.value || 'active'
        }),
        Api.get(API.CATEGORIES)
      ]);

      if (productsRes.success) {
        this.products = productsRes.data.products;
        this.totalPages = productsRes.data.pagination.total_pages;
        this.renderTable();
        this.renderPagination();
      }

      if (categoriesRes.success) {
        this.categories = categoriesRes.data.categories;
        this.renderCategoryFilter();
      }
    } catch (error) {
      Toast.show('Failed to load products', 'error');
    }
  },

  renderTable() {
    const tbody = document.getElementById('products-table-body');
    if (!this.products.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No products found</td></tr>';
      return;
    }

    tbody.innerHTML = this.products.map(product => `
      <tr>
        <td><strong>${Utils.escapeHtml(product.name)}</strong></td>
        <td>${product.sku || '-'}</td>
        <td>${product.barcode || '-'}</td>
        <td>${product.categories?.name || '-'}</td>
        <td>${Utils.formatCurrency(product.buying_price)}</td>
        <td>${Utils.formatCurrency(product.selling_price)}</td>
        <td class="${product.stock_quantity <= product.low_stock_threshold ? 'text-warning font-bold' : ''}">${product.stock_quantity}</td>
        <td><span class="badge ${Utils.getStatusBadgeClass(product.status)}">${Utils.capitalize(product.status)}</span></td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="ProductsPage.showEditModal('${product.id}')">Edit</button>
          ${product.status === 'active' ? 
            `<button class="btn btn-ghost btn-sm text-danger" onclick="ProductsPage.archive('${product.id}')">Archive</button>` :
            `<button class="btn btn-ghost btn-sm text-success" onclick="ProductsPage.restore('${product.id}')">Restore</button>`
          }
        </td>
      </tr>
    `).join('');
  },

  renderCategoryFilter() {
    const select = document.getElementById('products-category');
    if (!select) return;
    select.innerHTML = `
      <option value="">All Categories</option>
      ${this.categories.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('')}
    `;
  },

  renderPagination() {
    const container = document.getElementById('products-pagination');
    if (this.totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';
    html += `<button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="ProductsPage.goToPage(${this.currentPage - 1})">Previous</button>`;
    
    for (let i = 1; i <= this.totalPages; i++) {
      html += `<button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" onclick="ProductsPage.goToPage(${i})">${i}</button>`;
    }

    html += `<button class="pagination-btn" ${this.currentPage === this.totalPages ? 'disabled' : ''} onclick="ProductsPage.goToPage(${this.currentPage + 1})">Next</button>`;
    
    container.innerHTML = html;
  },

  setupEventListeners() {
    document.getElementById('products-search')?.addEventListener('input', 
      Utils.debounce((e) => {
        this.search = e.target.value;
        this.currentPage = 1;
        this.loadData();
      }, 300)
    );

    document.getElementById('products-category')?.addEventListener('change', () => {
      this.currentPage = 1;
      this.loadData();
    });

    document.getElementById('products-status')?.addEventListener('change', () => {
      this.currentPage = 1;
      this.loadData();
    });
  },

  goToPage(page) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadData();
  },

  showAddModal() {
    const content = `
      <form id="product-form">
        <div class="form-group">
          <label for="product-name">Name *</label>
          <input type="text" id="product-name" class="form-input" required>
        </div>
        <div class="grid grid-cols-2">
          <div class="form-group">
            <label for="product-sku">SKU</label>
            <input type="text" id="product-sku" class="form-input">
          </div>
          <div class="form-group">
            <label for="product-barcode">Barcode</label>
            <input type="text" id="product-barcode" class="form-input">
          </div>
        </div>
        <div class="form-group">
          <label for="product-category">Category</label>
          <select id="product-category" class="form-select">
            <option value="">No Category</option>
            ${this.categories.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="grid grid-cols-2">
          <div class="form-group">
            <label for="product-buying-price">Buying Price</label>
            <input type="number" id="product-buying-price" class="form-input" step="0.01" min="0" value="0">
          </div>
          <div class="form-group">
            <label for="product-selling-price">Selling Price *</label>
            <input type="number" id="product-selling-price" class="form-input" step="0.01" min="0" required>
          </div>
        </div>
        <div class="grid grid-cols-2">
          <div class="form-group">
            <label for="product-stock">Initial Stock</label>
            <input type="number" id="product-stock" class="form-input" min="0" value="0">
          </div>
          <div class="form-group">
            <label for="product-threshold">Low Stock Threshold</label>
            <input type="number" id="product-threshold" class="form-input" min="0" value="5">
          </div>
        </div>
        <div class="form-group">
          <label for="product-unit">Unit</label>
          <select id="product-unit" class="form-select">
            <option value="piece">Piece</option>
            <option value="kg">Kilogram</option>
            <option value="meter">Meter</option>
            <option value="box">Box</option>
            <option value="pair">Pair</option>
          </select>
        </div>
        <div class="form-group">
          <label for="product-description">Description</label>
          <textarea id="product-description" class="form-textarea"></textarea>
        </div>
      </form>
    `;

    Modal.show('Add Product', content, {
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="ProductsPage.saveProduct()">Save Product</button>
      `
    });
  },

  showEditModal(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const content = `
      <form id="product-form">
        <div class="form-group">
          <label for="product-name">Name *</label>
          <input type="text" id="product-name" class="form-input" value="${Utils.escapeHtml(product.name)}" required>
        </div>
        <div class="grid grid-cols-2">
          <div class="form-group">
            <label for="product-sku">SKU</label>
            <input type="text" id="product-sku" class="form-input" value="${product.sku || ''}">
          </div>
          <div class="form-group">
            <label for="product-barcode">Barcode</label>
            <input type="text" id="product-barcode" class="form-input" value="${product.barcode || ''}">
          </div>
        </div>
        <div class="form-group">
          <label for="product-category">Category</label>
          <select id="product-category" class="form-select">
            <option value="">No Category</option>
            ${this.categories.map(c => `<option value="${c.id}" ${product.category_id === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="grid grid-cols-2">
          <div class="form-group">
            <label for="product-buying-price">Buying Price</label>
            <input type="number" id="product-buying-price" class="form-input" step="0.01" min="0" value="${product.buying_price}">
          </div>
          <div class="form-group">
            <label for="product-selling-price">Selling Price *</label>
            <input type="number" id="product-selling-price" class="form-input" step="0.01" min="0" value="${product.selling_price}" required>
          </div>
        </div>
        <div class="grid grid-cols-2">
          <div class="form-group">
            <label for="product-stock">Stock Quantity</label>
            <input type="number" id="product-stock" class="form-input" min="0" value="${product.stock_quantity}">
          </div>
          <div class="form-group">
            <label for="product-threshold">Low Stock Threshold</label>
            <input type="number" id="product-threshold" class="form-input" min="0" value="${product.low_stock_threshold}">
          </div>
        </div>
        <div class="form-group">
          <label for="product-unit">Unit</label>
          <select id="product-unit" class="form-select">
            <option value="piece" ${product.unit === 'piece' ? 'selected' : ''}>Piece</option>
            <option value="kg" ${product.unit === 'kg' ? 'selected' : ''}>Kilogram</option>
            <option value="meter" ${product.unit === 'meter' ? 'selected' : ''}>Meter</option>
            <option value="box" ${product.unit === 'box' ? 'selected' : ''}>Box</option>
            <option value="pair" ${product.unit === 'pair' ? 'selected' : ''}>Pair</option>
          </select>
        </div>
        <div class="form-group">
          <label for="product-description">Description</label>
          <textarea id="product-description" class="form-textarea">${product.description || ''}</textarea>
        </div>
      </form>
    `;

    Modal.show('Edit Product', content, {
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="ProductsPage.updateProduct('${productId}')">Update Product</button>
      `
    });
  },

  async saveProduct() {
    const data = {
      name: document.getElementById('product-name').value,
      sku: document.getElementById('product-sku').value || null,
      barcode: document.getElementById('product-barcode').value || null,
      category_id: document.getElementById('product-category').value || null,
      buying_price: parseFloat(document.getElementById('product-buying-price').value) || 0,
      selling_price: parseFloat(document.getElementById('product-selling-price').value),
      stock_quantity: parseInt(document.getElementById('product-stock').value) || 0,
      low_stock_threshold: parseInt(document.getElementById('product-threshold').value) || 5,
      unit: document.getElementById('product-unit').value,
      description: document.getElementById('product-description').value || null
    };

    if (!data.name) {
      Toast.show('Product name is required', 'error');
      return;
    }

    if (data.selling_price < 0) {
      Toast.show('Selling price cannot be negative', 'error');
      return;
    }

    try {
      const response = await Api.post(API.PRODUCTS, data);
      if (response.success) {
        Modal.close();
        Toast.show('Product created successfully', 'success');
        this.loadData();
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to create product', 'error');
    }
  },

  async updateProduct(productId) {
    const data = {
      name: document.getElementById('product-name').value,
      sku: document.getElementById('product-sku').value || null,
      barcode: document.getElementById('product-barcode').value || null,
      category_id: document.getElementById('product-category').value || null,
      buying_price: parseFloat(document.getElementById('product-buying-price').value) || 0,
      selling_price: parseFloat(document.getElementById('product-selling-price').value),
      stock_quantity: parseInt(document.getElementById('product-stock').value) || 0,
      low_stock_threshold: parseInt(document.getElementById('product-threshold').value) || 5,
      unit: document.getElementById('product-unit').value,
      description: document.getElementById('product-description').value || null
    };

    try {
      const response = await Api.put(`${API.PRODUCTS}/${productId}`, data);
      if (response.success) {
        Modal.close();
        Toast.show('Product updated successfully', 'success');
        this.loadData();
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to update product', 'error');
    }
  },

  async archive(productId) {
    if (!confirm('Are you sure you want to archive this product?')) return;

    try {
      const response = await Api.delete(`${API.PRODUCTS}/${productId}`);
      if (response.success) {
        Toast.show('Product archived', 'success');
        this.loadData();
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to archive product', 'error');
    }
  },

  async restore(productId) {
    try {
      const response = await Api.put(`${API.PRODUCTS}/${productId}`, { status: 'active' });
      if (response.success) {
        Toast.show('Product restored', 'success');
        this.loadData();
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to restore product', 'error');
    }
  }
};

Router.registerPage('products', (container) => ProductsPage.render(container));
