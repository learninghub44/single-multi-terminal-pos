// Users Page
const UsersPage = {
  users: [],

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Users</h1>
        ${Auth.user?.role === 'owner' ? '<button class="btn btn-primary" onclick="UsersPage.showAddModal()">+ Add User</button>' : ''}
      </div>

      <div class="card">
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                ${Auth.user?.role === 'owner' ? '<th>Actions</th>' : ''}
              </tr>
            </thead>
            <tbody id="users-table-body">
              <tr><td colspan="5" class="text-center"><div class="spinner"></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    try {
      const response = await Api.get(API.USERS);
      if (response.success) {
        this.users = response.data.users;
        this.renderTable();
      }
    } catch (error) {
      Toast.show('Failed to load users', 'error');
    }
  },

  renderTable() {
    const tbody = document.getElementById('users-table-body');
    if (!this.users.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No users found</td></tr>';
      return;
    }

    const isOwner = Auth.user?.role === 'owner';
    tbody.innerHTML = this.users.map(u => `
      <tr>
        <td><strong>${Utils.escapeHtml(u.full_name)}</strong></td>
        <td>${u.email}</td>
        <td><span class="badge ${u.role === 'owner' ? 'badge-danger' : u.role === 'manager' ? 'badge-warning' : 'badge-info'}">${Utils.capitalize(u.role)}</span></td>
        <td>${Utils.formatDate(u.created_at)}</td>
        ${isOwner ? `
          <td>
            <button class="btn btn-ghost btn-sm" onclick="UsersPage.showEditModal('${u.id}')">Edit</button>
            ${u.id !== Auth.user.id ? `<button class="btn btn-ghost btn-sm text-danger" onclick="UsersPage.deleteUser('${u.id}')">Delete</button>` : ''}
          </td>
        ` : ''}
      </tr>
    `).join('');
  },

  showAddModal() {
    const content = `
      <form id="user-form">
        <div class="form-group">
          <label for="user-name">Full Name *</label>
          <input type="text" id="user-name" class="form-input" required>
        </div>
        <div class="form-group">
          <label for="user-email">Email *</label>
          <input type="email" id="user-email" class="form-input" required>
        </div>
        <div class="form-group">
          <label for="user-password">Password *</label>
          <input type="password" id="user-password" class="form-input" required minlength="6">
        </div>
        <div class="form-group">
          <label for="user-role">Role *</label>
          <select id="user-role" class="form-select" required>
            <option value="cashier">Cashier</option>
            <option value="manager">Manager</option>
            <option value="owner">Owner</option>
          </select>
        </div>
      </form>
    `;

    Modal.show('Add User', content, {
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="UsersPage.saveUser()">Save</button>
      `
    });
  },

  showEditModal(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;

    const content = `
      <form id="user-form">
        <div class="form-group">
          <label for="user-name">Full Name *</label>
          <input type="text" id="user-name" class="form-input" value="${Utils.escapeHtml(user.full_name)}" required>
        </div>
        <div class="form-group">
          <label for="user-email">Email *</label>
          <input type="email" id="user-email" class="form-input" value="${user.email}" required disabled>
        </div>
        <div class="form-group">
          <label for="user-password">New Password (leave blank to keep current)</label>
          <input type="password" id="user-password" class="form-input" minlength="6">
        </div>
        <div class="form-group">
          <label for="user-role">Role *</label>
          <select id="user-role" class="form-select" required>
            <option value="cashier" ${user.role === 'cashier' ? 'selected' : ''}>Cashier</option>
            <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Manager</option>
            <option value="owner" ${user.role === 'owner' ? 'selected' : ''}>Owner</option>
          </select>
        </div>
      </form>
    `;

    Modal.show('Edit User', content, {
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="UsersPage.updateUser('${userId}')">Update</button>
      `
    });
  },

  async saveUser() {
    const data = {
      full_name: document.getElementById('user-name').value,
      email: document.getElementById('user-email').value,
      password: document.getElementById('user-password').value,
      role: document.getElementById('user-role').value
    };

    if (!data.full_name || !data.email || !data.password) {
      Toast.show('Please fill in all required fields', 'error');
      return;
    }

    try {
      const response = await Api.post(API.USERS, data);
      if (response.success) {
        Modal.close();
        Toast.show('User created successfully', 'success');
        this.loadData();
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to create user', 'error');
    }
  },

  async updateUser(userId) {
    const data = {
      full_name: document.getElementById('user-name').value,
      role: document.getElementById('user-role').value
    };

    const password = document.getElementById('user-password').value;
    if (password) {
      data.password = password;
    }

    try {
      const response = await Api.put(`${API.USERS}/${userId}`, data);
      if (response.success) {
        Modal.close();
        Toast.show('User updated successfully', 'success');
        this.loadData();
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to update user', 'error');
    }
  },

  async deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const response = await Api.delete(`${API.USERS}/${userId}`);
      if (response.success) {
        Toast.show('User deleted', 'success');
        this.loadData();
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to delete user', 'error');
    }
  }
};

Router.registerPage('users', (container) => UsersPage.render(container));
