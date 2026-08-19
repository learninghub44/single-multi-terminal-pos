# Architecture Overview

This document describes the architecture of the Multi-Terminal POS System.

## System Overview

The POS System is a production-ready, multi-terminal point of sale solution designed for retail businesses. It supports multiple POS terminals sharing a single database, inventory, and user base.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                           │
├─────────────────────────────────────────────────────────────┤
│  Terminal A (Browser)  │  Terminal B (Browser)  │  Mobile   │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Edge Layer                                │
├─────────────────────────────────────────────────────────────┤
│              Cloudflare Workers (Hono)                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │  Auth   │ │  Sales  │ │ Products│ │ Reports │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
├─────────────────────────────────────────────────────────────┤
│                    Supabase                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              PostgreSQL Database                     │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │   │
│  │  │ Sales   │ │Products │ │Terminals│ │ Users   │  │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Auth (JWT)                              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│                   External Services                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                      │
│  │ M-Pesa  │ │ PayHero │ │ SMS/Email│                     │
│  └─────────┘ └─────────┘ └─────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

## Core Concepts

### Multi-Terminal Architecture

The system is designed for a **single business with multiple POS terminals**. This is NOT multi-tenancy.

```
Business: "My Retail Store"
├── Terminal: POS-01 (Counter 1)
├── Terminal: POS-02 (Counter 2)
└── Terminal: POS-03 (Counter 3)
```

All terminals share:
- Same database
- Same inventory
- Same users
- Same products
- Same customers

### Atomic Operations

Critical operations use database-level atomicity to prevent race conditions:

#### Stock Deduction
```sql
-- Uses FOR UPDATE to lock rows during deduction
BEGIN;
SELECT stock_quantity FROM products WHERE id = $1 FOR UPDATE;
-- Check stock
UPDATE products SET stock_quantity = stock_quantity - $2 WHERE id = $1;
COMMIT;
```

#### Receipt Number Generation
```sql
-- Uses advisory locks for unique numbers
SELECT pg_advisory_xact_lock(hashtext('receipt'));
-- Generate and insert receipt number
COMMIT;
```

### Terminal Validation

Every sale is validated against the terminal:

1. Terminal must exist
2. Terminal must be active
3. Terminal ID is stored with sale record
4. Terminal ID is stored with payment record
5. Terminal ID is stored in audit log

## Database Design

### Entity Relationship Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  terminals  │     │    sales    │     │   users     │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ id          │◄────│ terminal_id │     │ id          │
│ terminal_code│    │ user_id     │────►│ email       │
│ name        │     │ customer_id │     │ full_name   │
│ location    │     │ receipt_num │     │ role        │
│ status      │     │ subtotal    │     └─────────────┘
└─────────────┘     │ discount    │
                    │ tax         │
                    │ total       │
                    │ status      │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
       ┌─────────────┐ ┌─────────┐ ┌─────────────┐
       │ sale_items  │ │payments │ │audit_logs   │
       ├─────────────┤ ├─────────┤ ├─────────────┤
       │ sale_id     │ │ sale_id │ │ entity_id   │
       │ product_id  │ │ method  │ │ action      │
       │ quantity    │ │ amount  │ │ terminal_id │
       │ unit_price  │ │ status  │ │ metadata    │
       └─────────────┘ └─────────┘ └─────────────┘
              │
              ▼
       ┌─────────────┐
       │  products   │
       ├─────────────┤
       │ id          │
       │ name        │
       │ sku         │
       │ selling_price│
       │ stock_qty   │
       └─────────────┘
```

### Key Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `terminals` | POS terminal definitions | `terminal_code`, `status` |
| `cash_sessions` | Cash tracking per terminal | `opening_cash`, `expected_cash`, `actual_cash` |
| `sales` | Transaction records | `terminal_id`, `receipt_number`, `total` |
| `sale_items` | Items in each sale | `product_id`, `quantity`, `unit_price` |
| `payments` | Payment records | `method`, `amount`, `status` |
| `products` | Product catalog | `sku`, `selling_price`, `stock_quantity` |
| `inventory_movements` | Stock audit trail | `type`, `quantity`, `reference` |
| `audit_logs` | System audit trail | `action`, `entity`, `terminal_id` |

### Database Functions

#### `deduct_stock_atomically(p_product_id, p_quantity)`

Atomically deducts stock from a product using row locking.

```sql
CREATE OR REPLACE FUNCTION deduct_stock_atomically(
  p_product_id UUID,
  p_quantity INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_stock INTEGER;
BEGIN
  -- Lock the row
  SELECT stock_quantity INTO v_current_stock
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;
  
  -- Check stock
  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %', v_current_stock;
  END IF;
  
  -- Deduct stock
  UPDATE products
  SET stock_quantity = stock_quantity - p_quantity
  WHERE id = p_product_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

#### `generate_receipt_number()`

Generates a unique receipt number using advisory locks.

```sql
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT AS $$
DECLARE
  v_next_number INTEGER;
  v_receipt_number TEXT;
BEGIN
  -- Use advisory lock to prevent concurrent generation
  PERFORM pg_advisory_xact_lock(hashtext('receipt_number'));
  
  -- Get next number
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(receipt_number FROM 5) AS INTEGER)
  ), 0) + 1
  INTO v_next_number
  FROM sales
  WHERE receipt_number LIKE 'RCT-%';
  
  -- Format receipt number
  v_receipt_number := 'RCT-' || LPAD(v_next_number::TEXT, 7, '0');
  
  RETURN v_receipt_number;
END;
$$ LANGUAGE plpgsql;
```

## Concurrency Handling

### Race Condition Prevention

The system handles concurrent access at multiple levels:

#### 1. Database Level (Primary)

- **Row Locking**: `SELECT ... FOR UPDATE` locks rows during modification
- **Advisory Locks**: Prevent concurrent receipt number generation
- **Transaction Isolation**: PostgreSQL's default isolation level

#### 2. Application Level

- **Terminal Validation**: Each sale validates terminal is active
- **Stock Check**: Verify stock before creating sale items
- **Atomic Functions**: Database functions ensure consistency

#### 3. Client Level

- **Optimistic UI**: Show success immediately, rollback on error
- **Terminal Context**: Each terminal operates independently

### Example: Concurrent Sales

```
Terminal A: Sell 1 USB Cable (stock: 2)
Terminal B: Sell 1 USB Cable (stock: 2)

Timeline:
1. Terminal A: BEGIN
2. Terminal B: BEGIN
3. Terminal A: SELECT stock FROM products WHERE id = 'usb' FOR UPDATE
   → Locks row, reads stock = 2
4. Terminal B: SELECT stock FROM products WHERE id = 'usb' FOR UPDATE
   → Waits for lock...
5. Terminal A: UPDATE products SET stock = 1 WHERE id = 'usb'
6. Terminal A: COMMIT
   → Releases lock
7. Terminal B: Now acquires lock, reads stock = 1
8. Terminal B: UPDATE products SET stock = 0 WHERE id = 'usb'
9. Terminal B: COMMIT

Result: Both sales succeed, stock = 0
```

### Example: Insufficient Stock

```
Terminal A: Sell 2 USB Cables (stock: 1)
Terminal B: Sell 1 USB Cable (stock: 1)

Timeline:
1. Terminal A: BEGIN
2. Terminal B: BEGIN
3. Terminal A: SELECT stock FROM products WHERE id = 'usb' FOR UPDATE
   → Locks row, reads stock = 1
4. Terminal A: Check: 1 < 2 → Insufficient stock!
5. Terminal A: ROLLBACK
6. Terminal B: SELECT stock FROM products WHERE id = 'usb' FOR UPDATE
   → Acquires lock, reads stock = 1
7. Terminal B: Check: 1 >= 1 → OK
8. Terminal B: UPDATE products SET stock = 0 WHERE id = 'usb'
9. Terminal B: COMMIT

Result: Terminal A fails, Terminal B succeeds
```

## Payment Flow

### Cash Payment

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  Client  │     │  Server  │     │Database │     │ Receipt │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │
     │ 1. Create Sale│               │               │
     │──────────────>│               │               │
     │               │ 2. Validate   │               │
     │               │──────────────>│               │
     │               │ 3. Insert Sale│               │
     │               │──────────────>│               │
     │               │ 4. Insert Payment              │
     │               │──────────────>│               │
     │               │ 5. Deduct Stock│               │
     │               │──────────────>│               │
     │ 6. Return Sale│               │               │
     │<──────────────│               │               │
     │               │               │               │
     │ 7. Print Receipt              │               │
     │──────────────────────────────────────────────>│
```

### M-Pesa Payment

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  Client  │     │  Server  │     │M-Pesa API│    │ Database │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │
     │ 1. Create Sale│               │               │
     │──────────────>│               │               │
     │               │ 2. Initiate STK Push          │
     │               │──────────────>│               │
     │               │ 3. Return Pending│            │
     │<──────────────│               │               │
     │               │               │               │
     │ 4. Wait...    │               │               │
     │               │               │               │
     │               │ 5. Webhook Callback           │
     │               │<──────────────│               │
     │               │ 6. Update Payment Status      │
     │               │──────────────>│               │
```

## Security Architecture

### Authentication Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│  Client  │     │  Server  │     │Supabase │
└────┬────┘     └────┬────┘     └────┬────┘
     │               │               │
     │ 1. Login Request│             │
     │──────────────>│               │
     │               │ 2. Verify Credentials│
     │               │──────────────>│
     │               │ 3. Return JWT │
     │<──────────────│               │
     │               │               │
     │ 4. Store Token │               │
     │ (localStorage) │               │
     │               │               │
     │ 5. API Request │               │
     │ + Token        │               │
     │──────────────>│               │
     │               │ 6. Verify JWT │
     │               │──────────────>│
     │               │ 7. Return Data│
     │<──────────────│               │
```

### Authorization Levels

```
┌─────────────────────────────────────────┐
│                 Owner                   │
│  - Full access to all features          │
│  - Can manage users                     │
│  - Can manage terminals                 │
│  - Can view all reports                 │
├─────────────────────────────────────────┤
│                Manager                  │
│  - Can manage products                  │
│  - Can manage inventory                 │
│  - Can view sales and reports           │
│  - Can manage terminals                 │
├─────────────────────────────────────────┤
│                Cashier                  │
│  - Can process sales                    │
│  - Can view products                    │
│  - Can manage customers                 │
│  - Limited access                       │
└─────────────────────────────────────────┘
```

## Frontend Architecture

### Component Structure

```
┌─────────────────────────────────────────┐
│              Router                     │
│  - Hash-based routing                   │
│  - Page registration                    │
│  - Auth guards                          │
├─────────────────────────────────────────┤
│              Pages                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │Dashboard│ │   POS   │ │  Sales  │  │
│  └─────────┘ └─────────┘ └─────────┘  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │Products │ │Inventory│ │Customers│  │
│  └─────────┘ └─────────┘ └─────────┘  │
├─────────────────────────────────────────┤
│              Components                 │
│  ┌─────────┐ ┌─────────┐              │
│  │  Modal  │ │  Toast  │              │
│  └─────────┘ └─────────┘              │
├─────────────────────────────────────────┤
│              Services                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │   API   │ │  Auth   │ │  Utils  │  │
│  └─────────┘ └─────────┘ └─────────┘  │
└─────────────────────────────────────────┘
```

### State Management

```
┌─────────────────────────────────────────┐
│           Global State                  │
├─────────────────────────────────────────┤
│  Auth Module                            │
│  - user: {}                            │
│  - session: {}                         │
│  - terminal: {}                        │
├─────────────────────────────────────────┤
│  Router Module                          │
│  - currentPage: string                 │
│  - pages: {}                           │
├─────────────────────────────────────────┤
│  Local State                           │
│  - Page-specific data                  │
│  - UI state                            │
└─────────────────────────────────────────┘
```

## Deployment Architecture

### Development

```
┌─────────────────────────────────────────┐
│           Development                  │
├─────────────────────────────────────────┤
│  Backend: localhost:8787               │
│  Frontend: localhost:3000              │
│  Database: Supabase Cloud              │
└─────────────────────────────────────────┘
```

### Production

```
┌─────────────────────────────────────────┐
│           Production                   │
├─────────────────────────────────────────┤
│  Backend: Cloudflare Workers           │
│  - Global edge deployment              │
│  - Automatic scaling                   │
│  - DDoS protection                     │
├─────────────────────────────────────────┤
│  Frontend: Cloudflare Pages            │
│  - Global CDN                          │
│  - Automatic SSL                       │
│  - Automatic deployments               │
├─────────────────────────────────────────┤
│  Database: Supabase Pro                │
│  - Connection pooling                  │
│  - Automated backups                   │
│  - Point-in-time recovery              │
└─────────────────────────────────────────┘
```

## Performance Considerations

### Database Optimization

1. **Indexes**: Created on frequently queried columns
2. **Connection Pooling**: Supabase handles connection management
3. **Query Optimization**: Use select specific columns
4. **Pagination**: Limit result sets

### Frontend Optimization

1. **Minimal Bundle**: No framework overhead
2. **Lazy Loading**: Load pages on demand
3. **Caching**: Browser caching for static assets
4. **Optimistic UI**: Update UI immediately

### API Optimization

1. **Edge Computing**: Cloudflare Workers run globally
2. **Minimal Payloads**: Only transfer necessary data
3. **Batch Operations**: Combine multiple queries
4. **Error Handling**: Graceful degradation

## Monitoring & Logging

### Audit Trail

Every critical action is logged:

```sql
INSERT INTO audit_logs (user_id, action, entity, entity_id, terminal_id, metadata)
VALUES ($1, $2, $3, $4, $5, $6);
```

### Error Logging

Server-side errors are logged for debugging:

```typescript
console.error('Error:', error);
```

### Performance Monitoring

- Cloudflare Workers analytics
- Supabase dashboard metrics
- Client-side error tracking (optional: Sentry)

## Scaling Considerations

### Current Capacity

- **Concurrent Users**: 100+ per terminal
- **Terminals**: Unlimited (database limitation)
- **Products**: 10,000+
- **Sales**: 100,000+ per day

### Scaling Strategies

1. **Database**: Upgrade Supabase plan
2. **Backend**: Cloudflare Workers auto-scale
3. **Frontend**: CDN handles traffic spikes
4. **Caching**: Add Redis for frequently accessed data

## Future Enhancements

### Short Term

- [ ] Offline mode with sync
- [ ] Advanced analytics
- [ ] Email/SMS receipts

### Medium Term

- [ ] Multi-business support
- [ ] Stock transfers between terminals
- [ ] Shift management

### Long Term

- [ ] Mobile app (React Native)
- [ ] AI-powered analytics
- [ ] Supply chain integration

---

For more details, see:
- [API Documentation](./api.md)
- [Installation Guide](./installation.md)
- [Security Policy](../SECURITY.md)
