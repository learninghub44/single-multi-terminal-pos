// Users Page
const UsersPage = {
  users: [],
  invites: [],

  async render(container) {
    const canManage = Auth.user?.role === 'owner' || Auth.user?.role === 'manager';

    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Users</h1>
        <div class="page-header-actions">
          ${canManage ? '<button class="btn btn-secondary" onclick="UsersPage.showInviteModal()">+ Invite Staff</button>' : ''}
          ${Auth.user?.role === 'owner' ? '<button class="btn btn-primary" onclick="UsersPage.showAddModal()">+ Add User</button>' : ''}
        </div>
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

      ${canManage ? `
        <div class="card mt-lg">
          <div class="card-header">
            <h3 class="card-title">Pending Invites</h3>
          </div>
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Invited By</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="invites-table-body">
                <tr><td colspan="6" class="text-center"><div class="spinner"></div></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
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

    if (Auth.user?.role === 'owner' || Auth.user?.role === 'manager') {
      await this.loadInvites();
    }
  },

  async loadInvites() {
    try {
      const response = await Api.get(API.INVITES);
      if (response.success) {
        this.invites = response.data.invites;
        this.renderInvitesTable();
      }
    } catch (error) {
      console.error('Failed to load invites:', error);
    }
  },

  renderInvitesTable() {
    const tbody = document.getElementById('invites-table-body');
    if (!tbody) return;

    if (!this.invites.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No invites yet</td></tr>';
      return;
    }

    tbody.innerHTML = this.invites.map(inv => {
      const status = this.inviteStatus(inv);
      const link = this.buildInviteLink(inv.token);
      return `
        <tr>
          <td><span class="badge ${inv.role === 'owner' ? 'badge-danger' : inv.role === 'manager' ? 'badge-warning' : 'badge-info'}">${Utils.capitalize(inv.role)}</span></td>
          <td>${inv.email ? Utils.escapeHtml(inv.email) : '<span class="text-muted">Any</span>'}</td>
          <td>${inv.created_by_user?.full_name ? Utils.escapeHtml(inv.created_by_user.full_name) : '-'}</td>
          <td><span class="badge ${status.badgeClass}">${status.label}</span></td>
          <td>${Utils.formatDate(inv.expires_at)}</td>
          <td>
            ${status.label === 'Pending' ? `
              <button class="btn btn-ghost btn-sm" onclick="UsersPage.copyInviteLink('${link}')">Copy Link</button>
              <button class="btn btn-ghost btn-sm text-danger" onclick="UsersPage.revokeInvite('${inv.id}')">Revoke</button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  },

  inviteStatus(inv) {
    if (inv.used_at) return { label: 'Used', badgeClass: 'badge-success' };
    if (inv.revoked_at) return { label: 'Revoked', badgeClass: 'badge-danger' };
    if (new Date(inv.expires_at) < new Date()) return { label: 'Expired', badgeClass: 'badge-warning' };
    return { label: 'Pending', badgeClass: 'badge-info' };
  },

  buildInviteLink(token) {
    return `${window.location.origin}/#/accept-invite?token=${token}`;
  },

  showInviteModal() {
    const isOwner = Auth.user?.role === 'owner';
    const content = `
      <form id="invite-form">
        <div class="form-group">
          <label for="invite-role">Role *</label>
          <select id="invite-role" class="form-select" required>
            <option value="cashier">Cashier</option>
            ${isOwner ? '<option value="manager">Manager</option>' : ''}
            ${isOwner ? '<option value="owner">Owner</option>' : ''}
          </select>
          ${!isOwner ? '<div class="form-hint">Managers can only invite cashiers.</div>' : ''}
        </div>
        <div class="form-group">
          <label for="invite-email-field">Email (optional)</label>
          <input type="email" id="invite-email-field" class="form-input" placeholder="Leave blank to let anyone with the link sign up">
          <div class="form-hint">If set, only that email address can accept the invite.</div>
        </div>
      </form>
    `;

    Modal.show('Invite Staff Member', content, {
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="UsersPage.createInvite()">Generate Link</button>
      `
    });
  },

  async createInvite() {
    const role = document.getElementById('invite-role').value;
    const email = document.getElementById('invite-email-field').value;

    try {
      const response = await Api.post(API.INVITES, { role, email: email || undefined });
      if (response.success) {
        const link = this.buildInviteLink(response.data.invite.token);
        Modal.close();
        this.showInviteLinkModal(link);
        this.loadInvites();
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to create invite', 'error');
    }
  },

  showInviteLinkModal(link) {
    const content = `
      <p class="mb-md">Send this link to the new staff member. It works once and expires in 7 days.</p>
      <div class="form-group">
        <input type="text" id="invite-link-output" class="form-input" value="${Utils.escapeHtml(link)}" readonly onclick="this.select()">
      </div>
    `;

    Modal.show('Invite Link Ready', content, {
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Close</button>
        <button class="btn btn-primary" onclick="UsersPage.copyInviteLink('${link}')">Copy Link</button>
      `
    });
  },

  copyInviteLink(link) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link)
        .then(() => Toast.show('Invite link copied', 'success'))
        .catch(() => Toast.show('Could not copy - select and copy manually', 'error'));
    } else {
      Toast.show('Clipboard not available - select and copy manually', 'warning');
    }
  },

  async revokeInvite(inviteId) {
    if (!confirm('Revoke this invite? The link will stop working.')) return;

    try {
      const response = await Api.delete(`${API.INVITES}/${inviteId}`);
      if (response.success) {
        Toast.show('Invite revoked', 'success');
        this.loadInvites();
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to revoke invite', 'error');
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
