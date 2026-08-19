import { Env } from '../types';
import { authenticate, success_response, error_response } from '../middleware/auth';
import { getSupabaseService } from '../services/supabase';

export async function handleReceiptRoutes(request: Request, env: Env, path: string): Promise<Response> {
  const supabase = getSupabaseService(env);

  // GET /api/receipts/:receipt_number - Public endpoint for QR verification
  if (path.startsWith('/') && request.method === 'GET') {
    const receiptNumber = path.slice(1);

    const { data: sale, error } = await supabase
      .from('sales')
      .select('*, sale_items(*), payments(*), customers(name, phone), users(full_name), terminals(terminal_code, name)')
      .eq('receipt_number', receiptNumber)
      .single();

    if (error || !sale) {
      return error_response('NOT_FOUND', 'Receipt not found', 404);
    }

    // Return limited data for public verification
    return success_response({
      receipt_number: sale.receipt_number,
      date: sale.created_at,
      total: sale.total,
      status: sale.status,
      items: sale.sale_items?.map((item: { product_name_snapshot: string; quantity: number; unit_price: number; subtotal: number }) => ({
        name: item.product_name_snapshot,
        qty: item.quantity,
        price: item.unit_price,
        total: item.subtotal
      })),
      payment_method: sale.payments?.[0]?.method
    });
  }

  // GET /api/receipts/:receipt_number/html - Get receipt HTML for printing
  if (path.startsWith('/') && path.endsWith('/html') && request.method === 'GET') {
    // Auth required for printing
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return error_response('UNAUTHORIZED', 'Authentication required', 401);
    }

    const receiptNumber = path.slice(1, -5);

    const { data: settings } = await supabase
      .from('business_settings')
      .select('*')
      .limit(1)
      .single();

    const { data: sale, error } = await supabase
      .from('sales')
      .select('*, sale_items(*, products(sku, barcode)), payments(*), customers(name, phone), users(full_name), terminals(terminal_code, name)')
      .eq('receipt_number', receiptNumber)
      .single();

    if (error || !sale) {
      return error_response('NOT_FOUND', 'Receipt not found', 404);
    }

    const html = generateReceiptHTML(sale, settings);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html'
      }
    });
  }

  return error_response('NOT_FOUND', 'Endpoint not found', 404);
}

function generateReceiptHTML(sale: Record<string, unknown>, settings: Record<string, unknown> | null): string {
  const businessName = (settings as { business_name?: string })?.business_name || 'POS Store';
  const phone = (settings as { phone?: string })?.phone || '';
  const address = (settings as { address?: string })?.address || '';
  const receiptFooter = (settings as { receipt_footer?: string })?.receipt_footer || 'Thank you for shopping with us!';
  const receiptSize = (settings as { receipt_size?: string })?.receipt_size || '80mm';
  const width = receiptSize === '58mm' ? '58mm' : '80mm';

  const items = (sale.sale_items as Array<{
    product_name_snapshot: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    products?: { sku?: string; barcode?: string };
  }>) || [];

  const payment = (sale.payments as Array<{
    method: string;
    reference?: string;
    provider_reference?: string;
  }>)?.[0];

  const customer = sale.customers as { name?: string; phone?: string } | null;
  const cashier = sale.users as { full_name?: string } | null;
  const terminal = sale.terminals as { terminal_code?: string; name?: string } | null;

  const date = new Date(sale.created_at as string).toLocaleString('en-KE', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt ${sale.receipt_number}</title>
  <style>
    @page {
      size: ${width} auto;
      margin: 2mm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      width: ${width};
      padding: 2mm;
      background: white;
      color: black;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .line { border-top: 1px dashed #000; margin: 2mm 0; }
    .items { margin: 2mm 0; }
    .item {
      display: flex;
      justify-content: space-between;
      margin: 1mm 0;
    }
    .item-name { flex: 1; }
    .item-qty { width: 20px; text-align: center; }
    .item-price { width: 60px; text-align: right; }
    .totals { margin: 2mm 0; }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 1mm 0;
    }
    .footer { margin-top: 3mm; }
    @media print {
      body { width: ${width}; }
    }
  </style>
</head>
<body>
  <div class="center">
    <div class="bold" style="font-size: 14px;">${businessName}</div>
    ${phone ? `<div>${phone}</div>` : ''}
    ${address ? `<div>${address}</div>` : ''}
  </div>

  <div class="line"></div>

  <div>
    <div class="bold">RECEIPT ${sale.receipt_number}</div>
    <div>Date: ${date}</div>
    ${terminal?.terminal_code ? `<div>Terminal: ${terminal.terminal_code}</div>` : ''}
    ${cashier?.full_name ? `<div>Cashier: ${cashier.full_name}</div>` : ''}
    ${customer?.name ? `<div>Customer: ${customer.name}</div>` : ''}
  </div>

  <div class="line"></div>

  <div class="items">
    <div class="item bold">
      <span class="item-name">ITEM</span>
      <span class="item-qty">QTY</span>
      <span class="item-price">TOTAL</span>
    </div>
    ${items.map(item => `
    <div class="item">
      <span class="item-name">${item.product_name_snapshot}</span>
      <span class="item-qty">${item.quantity}</span>
      <span class="item-price">${formatCurrency(item.subtotal)}</span>
    </div>
    `).join('')}
  </div>

  <div class="line"></div>

  <div class="totals">
    <div class="total-row">
      <span>Subtotal</span>
      <span>${formatCurrency(sale.subtotal as number)}</span>
    </div>
    ${(sale.discount as number) > 0 ? `
    <div class="total-row">
      <span>Discount</span>
      <span>-${formatCurrency(sale.discount as number)}</span>
    </div>
    ` : ''}
    ${(sale.tax as number) > 0 ? `
    <div class="total-row">
      <span>Tax</span>
      <span>${formatCurrency(sale.tax as number)}</span>
    </div>
    ` : ''}
    <div class="total-row bold" style="font-size: 14px;">
      <span>TOTAL</span>
      <span>${formatCurrency(sale.total as number)}</span>
    </div>
  </div>

  <div class="line"></div>

  <div>
    <div class="bold">PAYMENT: ${payment?.method?.toUpperCase()}</div>
    ${payment?.provider_reference ? `<div>Reference: ${payment.provider_reference}</div>` : ''}
  </div>

  <div class="line"></div>

  <div class="center footer">
    <div>${receiptFooter}</div>
    <div style="margin-top: 2mm;">
      <div class="line" style="width: 40mm; margin: 1mm auto;"></div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`;
}

function formatCurrency(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
