import { Env } from './types';
import { cors_response, error_response, AuthenticationError, AuthorizationError, ValidationError, NotFoundError, ConflictError, InsufficientStockError } from './middleware/auth';
import { handleAuthRoutes } from './routes/auth';
import { handleProductRoutes } from './routes/products';
import { handleCategoryRoutes } from './routes/categories';
import { handleInventoryRoutes } from './routes/inventory';
import { handleSaleRoutes } from './routes/sales';
import { handleCustomerRoutes } from './routes/customers';
import { handleExpenseRoutes } from './routes/expenses';
import { handlePaymentRoutes } from './routes/payments';
import { handleWebhookRoutes } from './routes/webhooks';
import { handleReportRoutes } from './routes/reports';
import { handleSettingsRoutes } from './routes/settings';
import { handleUserRoutes } from './routes/users';
import { handleReceiptRoutes } from './routes/receipts';
import { handleTerminalRoutes } from './routes/terminals';
import { handleCashSessionRoutes } from './routes/cash-sessions';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return cors_response();
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // API routes
      if (path.startsWith('/api/')) {
        const apiPath = path.slice(4);

        // Auth routes (public)
        if (apiPath.startsWith('auth/')) {
          return handleAuthRoutes(request, env, apiPath.slice(5));
        }

        // Webhook routes (public, verified by provider)
        if (apiPath.startsWith('webhooks/')) {
          return handleWebhookRoutes(request, env, apiPath.slice(9));
        }

        // Protected routes
        if (apiPath.startsWith('products/')) {
          return handleProductRoutes(request, env, apiPath.slice(9));
        }
        if (apiPath === 'products' || apiPath.startsWith('products?')) {
          return handleProductRoutes(request, env, '');
        }

        if (apiPath.startsWith('categories/')) {
          return handleCategoryRoutes(request, env, apiPath.slice(11));
        }
        if (apiPath === 'categories' || apiPath.startsWith('categories?')) {
          return handleCategoryRoutes(request, env, '');
        }

        if (apiPath.startsWith('inventory/')) {
          return handleInventoryRoutes(request, env, apiPath.slice(10));
        }
        if (apiPath === 'inventory' || apiPath.startsWith('inventory?')) {
          return handleInventoryRoutes(request, env, '');
        }

        if (apiPath.startsWith('sales/')) {
          return handleSaleRoutes(request, env, apiPath.slice(6));
        }
        if (apiPath === 'sales' || apiPath.startsWith('sales?')) {
          return handleSaleRoutes(request, env, '');
        }

        if (apiPath.startsWith('customers/')) {
          return handleCustomerRoutes(request, env, apiPath.slice(10));
        }
        if (apiPath === 'customers' || apiPath.startsWith('customers?')) {
          return handleCustomerRoutes(request, env, '');
        }

        if (apiPath.startsWith('expenses/')) {
          return handleExpenseRoutes(request, env, apiPath.slice(9));
        }
        if (apiPath === 'expenses' || apiPath.startsWith('expenses?')) {
          return handleExpenseRoutes(request, env, '');
        }

        if (apiPath.startsWith('payments/')) {
          return handlePaymentRoutes(request, env, apiPath.slice(9));
        }
        if (apiPath === 'payments' || apiPath.startsWith('payments?')) {
          return handlePaymentRoutes(request, env, '');
        }

        if (apiPath.startsWith('reports/')) {
          return handleReportRoutes(request, env, apiPath.slice(8));
        }
        if (apiPath === 'reports' || apiPath.startsWith('reports?')) {
          return handleReportRoutes(request, env, '');
        }

        if (apiPath.startsWith('settings')) {
          return handleSettingsRoutes(request, env, apiPath.slice(9));
        }

        if (apiPath.startsWith('users/')) {
          return handleUserRoutes(request, env, apiPath.slice(6));
        }
        if (apiPath === 'users' || apiPath.startsWith('users?')) {
          return handleUserRoutes(request, env, '');
        }

        if (apiPath.startsWith('receipts/')) {
          return handleReceiptRoutes(request, env, apiPath.slice(9));
        }

        // Terminal routes
        if (apiPath === 'terminals' || apiPath.startsWith('terminals?')) {
          return handleTerminalRoutes(request, env, '');
        }
        if (apiPath.startsWith('terminals/')) {
          return handleTerminalRoutes(request, env, apiPath.slice(10));
        }

        // Cash session routes
        if (apiPath === 'cash-sessions' || apiPath.startsWith('cash-sessions?')) {
          return handleCashSessionRoutes(request, env, '');
        }
        if (apiPath.startsWith('cash-sessions/')) {
          return handleCashSessionRoutes(request, env, apiPath.slice(13));
        }

        return error_response('NOT_FOUND', 'API endpoint not found', 404);
      }

      // Non-API routes - serve frontend
      return new Response('Frontend should be served by static assets', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });

    } catch (error) {
      if (error instanceof AuthenticationError) {
        return error_response('UNAUTHORIZED', error.message, 401);
      }
      if (error instanceof AuthorizationError) {
        return error_response('FORBIDDEN', error.message, 403);
      }
      if (error instanceof ValidationError) {
        return error_response('VALIDATION_ERROR', error.message, 400);
      }
      if (error instanceof NotFoundError) {
        return error_response('NOT_FOUND', error.message, 404);
      }
      if (error instanceof ConflictError) {
        return error_response('CONFLICT', error.message, 409);
      }
      if (error instanceof InsufficientStockError) {
        return error_response('INSUFFICIENT_STOCK', error.message, 400);
      }

      console.error('Unhandled error:', error);
      return error_response('INTERNAL_ERROR', 'An unexpected error occurred', 500);
    }
  }
};
