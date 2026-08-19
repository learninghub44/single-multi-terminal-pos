// Expenses Page
const ExpensesPage = {
  expenses: [],
  currentPage: 1,
  totalPages: 1,

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Expenses</h1>
        <button class="btn btn-primary" onclick="ExpensesPage.showAddModal()">+ Add Expense</button>
      </div>

      <div class="card">
        <div class="filters-bar">
          <select id="expenses-category" class="form-select">
            <option value="">All Categories</option>
            <option value="Rent">Rent</option>
            <option value="Transport">Transport</option>
            <option value="Electricity">Electricity</option>
            <option value="Repairs">Repairs</option>
            <option value="Supplies">Supplies</option>
            <option value="Other">Other</option>
          </select>
          <input type="date" id="expenses-start-date" class="form-input">
          <input type="date" id="expenses-end-date" class="form-input">
        </div>

        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Recorded By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="expenses-table-body">
              <tr><td colspan="6" class="text-center"><div class="spinner"></div></td></tr>
            </tbody>
          </table>
        </div>

        <div id="expenses-pagination" class="pagination"></div>
      </div>
    `;

    await this.loadData();
    this.setupEventListeners();
  },

  async loadData() {
    try {
      const category = document.getElementById('expenses-category')?.value || '';
      const startDate = document.getElementById('expenses-start-date')?.value || '';
      const endDate = document.getElementById('expenses-end-date')?.value || '';

      const response = await Api.get(API.EXPENSES, {
        page: this.currentPage,
        limit: 20,
        category,
        start_date: startDate,
        end_date: endDate
      });

      if (response.success) {
        this.expenses = response.data.expenses;
        this.totalPages = response.data.pagination.total_pages;
        this.renderTable();
        this.renderPagination();
      }
    } catch (error) {
      Toast.show('Failed to load expenses', 'error');
    }
  },

  renderTable() {
    const tbody = document.getElementById('expenses-table-body');
    if (!this.expenses.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No expenses found</td></tr>';
      return;
    }

    tbody.innerHTML = this.expenses.map(e => `
      <tr>
        <td>${Utils.formatDate(e.created_at)}</td>
        <td><span class="badge badge-info">${e.category}</span></td>
        <td>${Utils.escapeHtml(e.description)}</td>
        <td><strong>${Utils.formatCurrency(e.amount)}</strong></td>
        <td>${e.users?.full_name || '-'}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="ExpensesPage.showEditModal('${e.id}')">Edit</button>
          <button class="btn btn-ghost btn-sm text-danger" onclick="ExpensesPage.deleteExpense('${e.id}')">Delete</button>
        </td>
      </tr>
    `).join('');
  },

  renderPagination() {
    const container = document.getElementById('expenses-pagination');
    if (this.totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';
    html += `<button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="ExpensesPage.goToPage(${this.currentPage - 1})">Previous</button>`;
    for (let i = 1; i <= this.totalPages; i++) {
      html += `<button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" onclick="ExpensesPage.goToPage(${i})">${i}</button>`;
    }
    html += `<button class="pagination-btn" ${this.currentPage === this.totalPages ? 'disabled' : ''} onclick="ExpensesPage.goToPage(${this.currentPage + 1})">Next</button>`;
    container.innerHTML = html;
  },

  setupEventListeners() {
    ['expenses-category', 'expenses-start-date', 'expenses-end-date'].forEach(id => {
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

  showAddModal() {
    const content = `
      <form id="expense-form">
        <div class="form-group">
          <label for="expense-category">Category *</label>
          <select id="expense-category" class="form-select" required>
            <option value="">Select Category</option>
            <option value="Rent">Rent</option>
            <option value="Transport">Transport</option>
            <option value="Electricity">Electricity</option>
            <option value="Repairs">Repairs</option>
            <option value="Supplies">Supplies</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div class="form-group">
          <label for="expense-description">Description *</label>
          <textarea id="expense-description" class="form-textarea" required></textarea>
        </div>
        <div class="form-group">
          <label for="expense-amount">Amount *</label>
          <input type="number" id="expense-amount" class="form-input" step="0.01" min="0.01" required>
        </div>
      </form>
    `;

    Modal.show('Add Expense', content, {
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="ExpensesPage.saveExpense()">Save</button>
      `
    });
  },

  showEditModal(expenseId) {
    const expense = this.expenses.find(e => e.id === expenseId);
    if (!expense) return;

    const content = `
      <form id="expense-form">
        <div class="form-group">
          <label for="expense-category">Category *</label>
          <select id="expense-category" class="form-select" required>
            <option value="">Select Category</option>
            <option value="Rent" ${expense.category === 'Rent' ? 'selected' : ''}>Rent</option>
            <option value="Transport" ${expense.category === 'Transport' ? 'selected' : ''}>Transport</option>
            <option value="Electricity" ${expense.category === 'Electricity' ? 'selected' : ''}>Electricity</option>
            <option value="Repairs" ${expense.category === 'Repairs' ? 'selected' : ''}>Repairs</option>
            <option value="Supplies" ${expense.category === 'Supplies' ? 'selected' : ''}>Supplies</option>
            <option value="Other" ${expense.category === 'Other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
        <div class="form-group">
          <label for="expense-description">Description *</label>
          <textarea id="expense-description" class="form-textarea" required>${Utils.escapeHtml(expense.description)}</textarea>
        </div>
        <div class="form-group">
          <label for="expense-amount">Amount *</label>
          <input type="number" id="expense-amount" class="form-input" step="0.01" min="0.01" value="${expense.amount}" required>
        </div>
      </form>
    `;

    Modal.show('Edit Expense', content, {
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="ExpensesPage.updateExpense('${expenseId}')">Update</button>
      `
    });
  },

  async saveExpense() {
    const data = {
      category: document.getElementById('expense-category').value,
      description: document.getElementById('expense-description').value,
      amount: parseFloat(document.getElementById('expense-amount').value)
    };

    if (!data.category || !data.description || !data.amount) {
      Toast.show('Please fill in all required fields', 'error');
      return;
    }

    try {
      const response = await Api.post(API.EXPENSES, data);
      if (response.success) {
        Modal.close();
        Toast.show('Expense recorded successfully', 'success');
        this.loadData();
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to record expense', 'error');
    }
  },

  async updateExpense(expenseId) {
    const data = {
      category: document.getElementById('expense-category').value,
      description: document.getElementById('expense-description').value,
      amount: parseFloat(document.getElementById('expense-amount').value)
    };

    try {
      const response = await Api.put(`${API.EXPENSES}/${expenseId}`, data);
      if (response.success) {
        Modal.close();
        Toast.show('Expense updated successfully', 'success');
        this.loadData();
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to update expense', 'error');
    }
  },

  async deleteExpense(expenseId) {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      const response = await Api.delete(`${API.EXPENSES}/${expenseId}`);
      if (response.success) {
        Toast.show('Expense deleted', 'success');
        this.loadData();
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to delete expense', 'error');
    }
  }
};

Router.registerPage('expenses', (container) => ExpensesPage.render(container));
