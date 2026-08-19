# Multi-Terminal POS System

A production-ready, multi-terminal Point of Sale system built for retail businesses. Supports multiple POS terminals sharing a single database with atomic inventory deduction, unique receipt generation, and real-time terminal performance tracking.

![POS System](https://img.shields.io/badge/POS-System-111111?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-C65D32?style=for-the-badge)

---

## Features

### Core POS Functionality
- **Multi-Terminal Support** — Multiple POS counters sharing one database, inventory, and user base
- **Atomic Inventory Deduction** — Database-level `FOR UPDATE` row locking prevents overselling
- **Unique Receipt Numbers** — Advisory lock-based receipt generation with no duplicates
- **Real-Time Stock Validation** — Server-side validation on every transaction

### Payment Processing
- **Cash Payments** — Instant completion with change calculation
- **M-Pesa Integration** — STK Push integration for mobile payments
- **PayHero Integration** — Alternative mobile payment provider

### Terminal Management
- **Terminal Activation/Deactivation** — Control which terminals can process sales
- **Cash Sessions** — One open session per terminal, tracks opening/expected/actual cash
- **Performance Tracking** — Per-terminal sales, transactions, and revenue breakdown

### Dashboard & Reporting
- **Premium Dashboard** — Dark/light theme with real-time business metrics
- **Sales Reports** — Filterable by terminal, date range, payment method
- **Financial Overview** — Revenue, COGS, expenses, and estimated profit
- **Inventory Alerts** — Low stock warnings with product details
- **Top Products** — Best-selling products ranked by revenue

### User Experience
- **Dual Theme** — Light and dark mode with persistent preference
- **Terminal-Aware UI** — Current terminal always visible in sidebar and topbar
- **Responsive Design** — Works on desktop, tablet, and mobile
- **Keyboard Scanner Support** — Barcode scanner compatible
- **Instant Receipt Printing** — Print-optimized receipt generation

---

## Architecture

```
pos/
├── backend/                    # Cloudflare Worker (Hono)
│   ├── src/
│   │   ├── index.ts           # Worker entry point
│   │   ├── types/index.ts     # TypeScript definitions
│   │   ├── middleware/        # Auth, validation
│   │   ├── routes/            # API endpoints
│   │   └── services/          # Supabase, payment providers
│   └── wrangler.toml          # Cloudflare config
├── frontend/                   # Vanilla JS SPA
│   ├── index.html
│   ├── css/
│   │   ├── design-system.css  # Theme variables, components
│   │   ├── layout.css         # Sidebar, topbar, layout
│   │   ├── dashboard.css      # Dashboard-specific styles
│   │   ├── pos.css            # POS screen styles
│   │   └── receipt.css        # Print receipt styles
│   └── js/
│       ├── config.js          # API endpoints, permissions
│       ├── api.js             # HTTP client
│       ├── auth.js            # Authentication, terminal
│       ├── router.js          # SPA routing, theme
│       ├── utils.js           # Formatting, helpers
│       ├── components/        # Modal, Toast
│       └── pages/             # Dashboard, POS, Sales, etc.
└── database/
    └── migration_multi_terminal.sql  # Schema migration
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Cloudflare Workers + Hono |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (JWT) |
| Payments | M-Pesa (Daraja API), PayHero |
| Frontend | Vanilla JavaScript SPA |
| Hosting | Cloudflare Workers |

---

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `terminals` | POS terminal definitions (code, name, status) |
| `cash_sessions` | Open/close cash sessions per terminal |
| `sales` | Transaction records with terminal_id |
| `sale_items` | Individual items in each sale |
| `payments` | Payment records (cash, mpesa, payhero) |
| `products` | Product catalog with stock tracking |
| `inventory_movements` | Stock movement audit trail |
| `audit_logs` | System audit trail with terminal_id |

### Key Functions

```sql
-- Atomic stock deduction with row locking
SELECT deduct_stock_atomically(p_product_id, p_quantity);

-- Unique receipt number generation
SELECT generate_receipt_number();
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account
- Cloudflare account (for deployment)
- M-Pesa Daraja API credentials (optional)
- PayHero API credentials (optional)

### 1. Clone & Install

```bash
git clone https://github.com/learninghub44/single-multi-terminal-pos.git
cd single-multi-terminal-pos

# Backend
cd backend
npm install

# Frontend (no build required)
cd ../frontend
```

### 2. Database Setup

1. Create a new Supabase project
2. Run the migration SQL:

```bash
# Via Supabase SQL Editor
cat database/migration_multi_terminal.sql
```

This creates:
- `terminals` table
- `cash_sessions` table
- `terminal_id` columns on sales, payments, audit_logs
- `deduct_stock_atomically()` function
- `generate_receipt_number()` function
- Indexes and RLS policies

### 3. Backend Configuration

Create `backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
MPESA_CONSUMER_KEY=your-mpesa-key
MPESA_CONSUMER_SECRET=your-mpesa-secret
MPESA_SHORTCODE=your-shortcode
MPESA_PASSKEY=your-passkey
PAYHERO_API_KEY=your-payhero-key
JWT_SECRET=your-jwt-secret
```

### 4. Run Development

```bash
# Backend
cd backend
npm run dev

# Frontend (serve with any static server)
cd frontend
npx serve .
```

### 5. Deploy

```bash
# Backend to Cloudflare Workers
cd backend
npm run deploy
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/logout` | Logout current session |
| GET | `/api/auth/user` | Get current user profile |

### Terminals
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/terminals` | List all terminals |
| POST | `/api/terminals` | Create new terminal |
| PUT | `/api/terminals/:id` | Update terminal |
| POST | `/api/terminals/:id/deactivate` | Deactivate terminal |
| POST | `/api/terminals/:id/activate` | Activate terminal |
| GET | `/api/terminals/:id/activity` | Terminal activity log |

### Cash Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cash-sessions` | List cash sessions |
| POST | `/api/cash-sessions` | Open new cash session |
| PUT | `/api/cash-sessions/:id/close` | Close cash session |
| GET | `/api/cash-sessions/active` | Get active session |

### Sales
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sales` | List sales (with filters) |
| POST | `/api/sales` | Create sale (checkout) |
| GET | `/api/sales/:id` | Get sale details |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/sales` | Sales summary |
| GET | `/api/reports/payment-methods` | Payment breakdown |
| GET | `/api/reports/profit` | Profit analysis |
| GET | `/api/reports/products` | Top selling products |
| GET | `/api/reports/inventory` | Inventory status |
| GET | `/api/reports/expenses` | Expense summary |

---

## Terminal Workflow

### 1. Terminal Selection
```
User opens POS → Selects terminal from list → Terminal stored locally
```

### 2. Cash Session
```
Open cash session → Enter opening cash → Process sales → Close session
```

### 3. Processing a Sale
```
Scan/Add items → Select payment method → Enter payment details
    ↓
Server validates:
    ✓ Terminal is active
    ✓ All products exist and are active
    ✓ Sufficient stock for all items
    ✓ Prices match current product prices
    ↓
Server processes:
    ✓ Generate unique receipt number (advisory lock)
    ✓ Create sale record
    ✓ Create payment record
    ✓ Deduct stock atomically (FOR UPDATE)
    ✓ Create inventory movement records
    ✓ Log audit trail
    ↓
Return receipt with change (cash) or pending status (mpesa/payhero)
```

---

## Multi-Terminal Concurrency

The system handles concurrent access at the database level:

1. **Stock Deduction** — Uses `SELECT ... FOR UPDATE` to lock product rows during deduction
2. **Receipt Numbers** — Uses PostgreSQL advisory locks to prevent duplicate receipt numbers
3. **Cash Sessions** — Enforces one open session per terminal at the database level

### Example Scenario
```
Terminal A and Terminal B both sell the last unit of Product X simultaneously.

1. Terminal A's request locks Product X row (FOR UPDATE)
2. Terminal A deducts stock: 1 → 0
3. Terminal A commits transaction
4. Terminal B's request tries to lock Product X
5. Terminal B sees stock = 0
6. Terminal B receives "Insufficient stock" error
7. Terminal B's sale is rolled back
```

---

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `MPESA_CONSUMER_KEY` | M-Pesa API consumer key | No |
| `MPESA_CONSUMER_SECRET` | M-Pesa API consumer secret | No |
| `MPESA_SHORTCODE` | M-Pesa business shortcode | No |
| `MPESA_PASSKEY` | M-Pesa API passkey | No |
| `PAYHERO_API_KEY` | PayHero API key | No |
| `JWT_SECRET` | JWT signing secret | Yes |

### Frontend Configuration

Edit `frontend/js/config.js`:

```javascript
const CONFIG = {
  API_BASE: '/api',
  CURRENCY: 'KES',
  TIMEZONE: 'Africa/Nairobi',
  RECEIPT_SIZE: '80mm'
};
```

---

## Permissions

| Role | Access |
|------|--------|
| Owner | Full access to all features |
| Manager | Dashboard, POS, Products, Inventory, Sales, Customers, Expenses, Reports, Terminals |
| Cashier | POS, Products, Customers, Sales |

---

## Receipt Format

Supports both 58mm and 80mm receipt printers:

```
┌────────────────────────────┐
│      BUSINESS NAME         │
│    Address & Phone         │
│────────────────────────────│
│ Receipt: RCT-0001245       │
│ Date: 19 Aug 2026 14:32    │
│ Terminal: POS-01           │
│ Cashier: Chris             │
│────────────────────────────│
│ USB Cable        x2  1,000 │
│ Wireless Mouse   x1  2,500 │
│────────────────────────────│
│ Subtotal:           3,500  │
│ Total:              3,500  │
│────────────────────────────│
│ Payment: M-Pesa             │
│ Reference: QHK7X9YZ4P      │
│────────────────────────────│
│     Thank you!             │
└────────────────────────────┘
```

---

## Development

### Backend Structure

```typescript
// Route handler example
export async function handleSaleRoutes(request: Request, env: Env, path: string): Promise<Response> {
  // GET /api/sales
  if (path === '' && request.method === 'GET') {
    // List sales with terminal filter
  }

  // POST /api/sales
  if (path === '' && request.method === 'POST') {
    // Create sale with atomic inventory deduction
  }
}
```

### Frontend Structure

```javascript
// Page component example
const DashboardPage = {
  async render(container) {
    container.innerHTML = `<div class="dashboard">...</div>`;
    await this.loadData();
  },

  async loadData() {
    // Fetch and render dashboard data
  }
};

Router.registerPage('dashboard', (container) => DashboardPage.render(container));
```

---

## Testing

### Manual Testing Checklist

- [ ] Login with different roles (owner, manager, cashier)
- [ ] Select terminal and open cash session
- [ ] Process cash sale with change calculation
- [ ] Process M-Pesa sale and verify pending status
- [ ] Verify stock deduction across concurrent terminals
- [ ] Close cash session and verify totals
- [ ] Test terminal activation/deactivation
- [ ] Verify receipt printing
- [ ] Test theme switching (light/dark)
- [ ] Test responsive layout on tablet/mobile

### Concurrency Test

```bash
# Terminal A
curl -X POST /api/sales \
  -H "Authorization: Bearer <token-a>" \
  -d '{"items":[{"product_id":"...","quantity":1}],"payment_method":"cash","terminal_id":"<terminal-a>","payment_details":{"amount_received":1000}}'

# Terminal B (simultaneous)
curl -X POST /api/sales \
  -H "Authorization: Bearer <token-b>" \
  -d '{"items":[{"product_id":"...","quantity":1}],"payment_method":"cash","terminal_id":"<terminal-b>","payment_details":{"amount_received":1000}}'

# Expected: One succeeds, one fails with insufficient stock
```

---

## Deployment

### Cloudflare Workers

```bash
cd backend
npm run deploy
```

### Custom Domain

1. Add custom domain in Cloudflare Workers dashboard
2. Update `CORS_ORIGIN` in environment variables
3. Configure DNS records

### Supabase

1. Create production Supabase project
2. Run migration SQL
3. Set up Row Level Security policies
4. Configure connection pooling

---

## Security

- JWT-based authentication
- Server-side validation on all inputs
- Atomic database operations prevent race conditions
- Row-level security policies
- Audit logging for all transactions
- Terminal validation on every sale

---

## Performance

- **Atomic Operations** — Database-level locking prevents overselling
- **Optimistic UI** — Frontend updates immediately, rolls back on error
- **Minimal Payloads** — Only necessary data transferred
- **CDN Delivery** — Static assets via Cloudflare CDN
- **Connection Pooling** — Supabase handles connection management

---

## Roadmap

- [ ] Multi-business support (true multi-tenancy)
- [ ] Offline mode with sync
- [ ] Advanced analytics dashboard
- [ ] Email/SMS receipt delivery
- [ ] Product image upload
- [ ] Barcode generation
- [ ] Stock transfer between terminals
- [ ] Shift management
- [ ] Gratuity/tip support
- [ ] Loyalty program integration

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Support

For issues and questions:
- Open an issue on GitHub
- Email: support@example.com

---

## Acknowledgments

- [Supabase](https://supabase.com/) - Database and authentication
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge computing
- [Hono](https://hono.dev/) - Web framework
- [Daraja API](https://developer.safaricom.co.ke/) - M-Pesa integration
