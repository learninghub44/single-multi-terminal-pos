// Router
const Router = {
  currentPage: null,
  pages: {},
  pageTitles: {
    dashboard: 'Dashboard',
    pos: 'Point of Sale',
    products: 'Products',
    inventory: 'Inventory',
    sales: 'Sales',
    customers: 'Customers',
    expenses: 'Expenses',
    reports: 'Reports',
    users: 'Users',
    terminals: 'Terminals',
    settings: 'Settings'
  },

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    this.initTheme();
    this.handleRoute();
  },

  initTheme() {
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => this.toggleTheme());
    }
  },

  toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('pos_theme', next);
  },

  registerPage(name, handler) {
    this.pages[name] = handler;
  },

  handleRoute() {
    const hash = window.location.hash.slice(1) || '/dashboard';
    const page = hash.split('/')[1] || 'dashboard';

    // Check authentication
    if (!Auth.isLoggedIn() && page !== 'login') {
      window.location.hash = '#/login';
      return;
    }

    // Check permissions
    if (Auth.isLoggedIn() && !Auth.hasPermission(page)) {
      Toast.show('Access denied', 'error');
      window.location.hash = '#/dashboard';
      return;
    }

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Show/hide elements based on auth
    const loginPage = document.getElementById('login-page');
    const mainApp = document.getElementById('main-app');

    if (page === 'login' || !Auth.isLoggedIn()) {
      loginPage.classList.remove('hidden');
      mainApp.classList.add('hidden');
    } else {
      loginPage.classList.add('hidden');
      mainApp.classList.remove('hidden');

      // Update topbar title
      const topbarTitle = document.getElementById('topbar-title');
      if (topbarTitle) {
        topbarTitle.textContent = this.pageTitles[page] || 'Dashboard';
      }

      // Update user info
      const userNameEl = document.getElementById('user-name');
      const userRoleEl = document.getElementById('user-role');
      const userAvatarEl = document.getElementById('user-avatar');

      if (userNameEl) userNameEl.textContent = Auth.user?.full_name || '';
      if (userRoleEl) userRoleEl.textContent = Auth.user?.role || '';
      if (userAvatarEl) {
        const name = Auth.user?.full_name || '';
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        userAvatarEl.textContent = initials;
      }

      // Update terminal info
      const terminal = Auth.getTerminal();
      this.updateTerminalDisplay(terminal);

      // Hide/show nav items based on role
      document.querySelectorAll('.nav-item[data-role]').forEach(item => {
        const requiredRole = item.dataset.role;
        if (requiredRole === 'owner' && Auth.user?.role !== 'owner') {
          item.classList.add('hidden');
        } else if (requiredRole === 'manager' && Auth.user?.role === 'cashier') {
          item.classList.add('hidden');
        } else {
          item.classList.remove('hidden');
        }
      });
    }

    // Render page
    this.currentPage = page;
    const container = document.getElementById('page-container');

    if (this.pages[page]) {
      this.pages[page](container);
    } else {
      container.innerHTML = '<div class="empty-state"><p>Page not found</p></div>';
    }
  },

  updateTerminalDisplay(terminal) {
    // Sidebar terminal
    const sidebarTerminal = document.getElementById('sidebar-terminal');
    const sidebarCode = document.getElementById('sidebar-terminal-code');
    const sidebarName = document.getElementById('sidebar-terminal-name');

    // Topbar terminal
    const topbarTerminal = document.getElementById('topbar-terminal');
    const topbarCode = document.getElementById('topbar-terminal-code');

    if (terminal) {
      if (sidebarTerminal) {
        sidebarTerminal.style.display = 'block';
        sidebarCode.textContent = terminal.terminal_code;
        sidebarName.textContent = terminal.name;
      }
      if (topbarTerminal) {
        topbarTerminal.style.display = 'flex';
        topbarCode.textContent = terminal.terminal_code;
      }
    } else {
      if (sidebarTerminal) sidebarTerminal.style.display = 'none';
      if (topbarTerminal) topbarTerminal.style.display = 'none';
    }
  },

  navigate(page) {
    window.location.hash = `#/${page}`;
  }
};
