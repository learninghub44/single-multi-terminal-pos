// Settings Page
const SettingsPage = {
  settings: null,

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Settings</h1>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Business Information</h3>
        </div>
        <form id="settings-form">
          <div class="grid grid-cols-2">
            <div class="form-group">
              <label for="settings-name">Business Name *</label>
              <input type="text" id="settings-name" class="form-input" required>
            </div>
            <div class="form-group">
              <label for="settings-phone">Phone</label>
              <input type="tel" id="settings-phone" class="form-input">
            </div>
          </div>
          <div class="grid grid-cols-2">
            <div class="form-group">
              <label for="settings-email">Email</label>
              <input type="email" id="settings-email" class="form-input">
            </div>
            <div class="form-group">
              <label for="settings-website">Website</label>
              <input type="url" id="settings-website" class="form-input">
            </div>
          </div>
          <div class="form-group">
            <label for="settings-address">Address</label>
            <input type="text" id="settings-address" class="form-input">
          </div>
          <div class="form-group">
            <label for="settings-location">Location</label>
            <input type="text" id="settings-location" class="form-input">
          </div>

          <div class="card-header mt-lg">
            <h3 class="card-title">Receipt Settings</h3>
          </div>
          <div class="grid grid-cols-2">
            <div class="form-group">
              <label for="settings-receipt-footer">Receipt Footer</label>
              <textarea id="settings-receipt-footer" class="form-textarea"></textarea>
            </div>
            <div class="form-group">
              <label for="settings-return-policy">Return Policy</label>
              <textarea id="settings-return-policy" class="form-textarea"></textarea>
            </div>
          </div>
          <div class="grid grid-cols-2">
            <div class="form-group">
              <label for="settings-receipt-size">Receipt Size</label>
              <select id="settings-receipt-size" class="form-select">
                <option value="80mm">80mm</option>
                <option value="58mm">58mm</option>
              </select>
            </div>
            <div class="form-group">
              <label for="settings-currency">Currency</label>
              <input type="text" id="settings-currency" class="form-input" value="KES" disabled>
            </div>
          </div>

          <div class="card-header mt-lg">
            <h3 class="card-title">Inventory Settings</h3>
          </div>
          <div class="grid grid-cols-2">
            <div class="form-group">
              <label for="settings-tax-rate">Tax Rate (%)</label>
              <input type="number" id="settings-tax-rate" class="form-input" step="0.01" min="0" max="100">
            </div>
            <div class="form-group">
              <label for="settings-low-stock">Low Stock Default</label>
              <input type="number" id="settings-low-stock" class="form-input" min="0">
            </div>
          </div>

          <div class="mt-lg">
            <button type="submit" class="btn btn-primary">Save Settings</button>
          </div>
        </form>
      </div>
    `;

    await this.loadData();
    this.setupEventListeners();
  },

  async loadData() {
    try {
      const response = await Api.get(API.SETTINGS);
      if (response.success) {
        this.settings = response.data;
        this.populateForm();
      }
    } catch (error) {
      Toast.show('Failed to load settings', 'error');
    }
  },

  populateForm() {
    if (!this.settings) return;

    document.getElementById('settings-name').value = this.settings.business_name || '';
    document.getElementById('settings-phone').value = this.settings.phone || '';
    document.getElementById('settings-email').value = this.settings.email || '';
    document.getElementById('settings-website').value = this.settings.website || '';
    document.getElementById('settings-address').value = this.settings.address || '';
    document.getElementById('settings-location').value = this.settings.location || '';
    document.getElementById('settings-receipt-footer').value = this.settings.receipt_footer || '';
    document.getElementById('settings-return-policy').value = this.settings.return_policy || '';
    document.getElementById('settings-receipt-size').value = this.settings.receipt_size || '80mm';
    document.getElementById('settings-tax-rate').value = this.settings.tax_rate || 0;
    document.getElementById('settings-low-stock').value = this.settings.low_stock_default || 5;
  },

  setupEventListeners() {
    document.getElementById('settings-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettings();
    });
  },

  async saveSettings() {
    const data = {
      business_name: document.getElementById('settings-name').value,
      phone: document.getElementById('settings-phone').value || null,
      email: document.getElementById('settings-email').value || null,
      website: document.getElementById('settings-website').value || null,
      address: document.getElementById('settings-address').value || null,
      location: document.getElementById('settings-location').value || null,
      receipt_footer: document.getElementById('settings-receipt-footer').value || null,
      return_policy: document.getElementById('settings-return-policy').value || null,
      receipt_size: document.getElementById('settings-receipt-size').value,
      tax_rate: parseFloat(document.getElementById('settings-tax-rate').value) || 0,
      low_stock_default: parseInt(document.getElementById('settings-low-stock').value) || 5
    };

    try {
      const response = await Api.put(API.SETTINGS, data);
      if (response.success) {
        Toast.show('Settings saved successfully', 'success');
        this.settings = response.data;
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to save settings', 'error');
    }
  }
};

Router.registerPage('settings', (container) => SettingsPage.render(container));
