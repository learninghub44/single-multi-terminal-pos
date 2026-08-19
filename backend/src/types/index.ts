export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  MPESA_CONSUMER_KEY: string;
  MPESA_CONSUMER_SECRET: string;
  MPESA_PASSKEY: string;
  MPESA_SHORTCODE: string;
  MPESA_CALLBACK_URL: string;
  PAYHERO_API_KEY: string;
  PAYHERO_API_URL: string;
  PAYHERO_CALLBACK_URL: string;
}

export interface User {
  id: string;
  email: string;
  role: 'owner' | 'manager' | 'cashier';
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  buying_price: number;
  selling_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  unit: string;
  status: 'active' | 'archived';
  description: string | null;
  image: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  receipt_number: string;
  customer_id: string | null;
  user_id: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  buying_price_snapshot: number;
  subtotal: number;
}

export interface Payment {
  id: string;
  sale_id: string;
  method: 'cash' | 'mpesa' | 'payhero';
  provider: 'cash' | 'mpesa' | 'payhero';
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired' | 'refunded';
  phone: string | null;
  reference: string | null;
  provider_reference: string | null;
  provider_response: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  type: 'opening_stock' | 'purchase' | 'sale' | 'return' | 'damage' | 'adjustment';
  quantity: number;
  reference: string | null;
  notes: string | null;
  user_id: string;
  created_at: string;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  user_id: string;
  created_at: string;
}

export interface BusinessSettings {
  id: string;
  business_name: string;
  logo: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  location: string | null;
  website: string | null;
  receipt_footer: string | null;
  return_policy: string | null;
  currency: string;
  tax_rate: number;
  low_stock_default: number;
  receipt_size: '58mm' | '80mm';
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Terminal {
  id: string;
  terminal_code: string;
  name: string;
  location: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface CashSession {
  id: string;
  terminal_id: string;
  user_id: string;
  opening_cash: number;
  expected_cash: number;
  actual_cash: number | null;
  difference: number | null;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
}

export interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  buying_price: number;
  subtotal: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
