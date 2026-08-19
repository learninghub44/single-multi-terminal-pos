// Configuration
const CONFIG = {
  API_BASE: '/api',
  SUPABASE_URL: '', // Will be set from environment
  SUPABASE_ANON_KEY: '', // Will be set from environment
  CURRENCY: 'KES',
  TIMEZONE: 'Africa/Nairobi',
  RECEIPT_SIZE: '80mm'
};

// Environment detection
const isProduction = window.location.hostname !== 'localhost';
const isDevelopment = !isProduction;

// API endpoints
const API = {
  AUTH: {
    LOGIN: `${CONFIG.API_BASE}/auth/login`,
    LOGOUT: `${CONFIG.API_BASE}/auth/logout`,
    REFRESH: `${CONFIG.API_BASE}/auth/refresh`,
    USER: `${CONFIG.API_BASE}/auth/user`
  },
  PRODUCTS: `${CONFIG.API_BASE}/products`,
  CATEGORIES: `${CONFIG.API_BASE}/categories`,
  INVENTORY: `${CONFIG.API_BASE}/inventory`,
  SALES: `${CONFIG.API_BASE}/sales`,
  CUSTOMERS: `${CONFIG.API_BASE}/customers`,
  EXPENSES: `${CONFIG.API_BASE}/expenses`,
  PAYMENTS: {
    MPEZA_INITIATE: `${CONFIG.API_BASE}/payments/mpesa/initiate`,
    PAYHERO_INITIATE: `${CONFIG.API_BASE}/payments/payhero/initiate`,
    STATUS: (id) => `${CONFIG.API_BASE}/payments/${id}/status`
  },
  WEBHOOKS: {
    MPEZA: `${CONFIG.API_BASE}/webhooks/mpesa`,
    PAYHERO: `${CONFIG.API_BASE}/webhooks/payhero`
  },
  REPORTS: {
    SALES: `${CONFIG.API_BASE}/reports/sales`,
    PAYMENT_METHODS: `${CONFIG.API_BASE}/reports/payment-methods`,
    PRODUCTS: `${CONFIG.API_BASE}/reports/products`,
    INVENTORY: `${CONFIG.API_BASE}/reports/inventory`,
    EXPENSES: `${CONFIG.API_BASE}/reports/expenses`,
    PROFIT: `${CONFIG.API_BASE}/reports/profit`
  },
  SETTINGS: `${CONFIG.API_BASE}/settings`,
  USERS: `${CONFIG.API_BASE}/users`,
  TERMINALS: `${CONFIG.API_BASE}/terminals`,
  CASH_SESSIONS: `${CONFIG.API_BASE}/cash-sessions`,
  RECEIPTS: (number) => `${CONFIG.API_BASE}/receipts/${number}`
};

// Role permissions
const PERMISSIONS = {
  owner: ['dashboard', 'pos', 'products', 'inventory', 'sales', 'customers', 'expenses', 'reports', 'users', 'settings', 'terminals'],
  manager: ['dashboard', 'pos', 'products', 'inventory', 'sales', 'customers', 'expenses', 'reports', 'terminals'],
  cashier: ['pos', 'products', 'customers', 'sales']
};
