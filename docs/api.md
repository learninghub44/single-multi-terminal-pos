# API Documentation

This document provides detailed information about the POS System API endpoints.

## Base URL

```
Development: http://localhost:8787/api
Production: https://your-domain.com/api
```

## Authentication

All API requests require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### Obtain Token

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "role": "owner"
    },
    "session": {
      "access_token": "jwt-token",
      "expires_at": 1234567890
    }
  }
}
```

## Endpoints

### Authentication

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

#### Get Current User
```http
GET /api/auth/user
Authorization: Bearer <token>
```

---

### Terminals

#### List Terminals
```http
GET /api/terminals
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` - Filter by status (active/inactive)

**Response:**
```json
{
  "success": true,
  "data": {
    "terminals": [
      {
        "id": "uuid",
        "terminal_code": "POS-01",
        "name": "Counter 1",
        "location": "Main entrance",
        "status": "active",
        "created_at": "2026-08-19T10:00:00Z"
      }
    ]
  }
}
```

#### Create Terminal
```http
POST /api/terminals
Authorization: Bearer <token>
Content-Type: application/json

{
  "terminal_code": "POS-01",
  "name": "Counter 1",
  "location": "Main entrance"
}
```

#### Update Terminal
```http
PUT /api/terminals/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Counter 1 - Updated",
  "location": "Main entrance - East"
}
```

#### Activate Terminal
```http
POST /api/terminals/:id/activate
Authorization: Bearer <token>
```

#### Deactivate Terminal
```http
POST /api/terminals/:id/deactivate
Authorization: Bearer <token>
```

#### Get Terminal Activity
```http
GET /api/terminals/:id/activity
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "terminal": {
      "id": "uuid",
      "terminal_code": "POS-01"
    },
    "today_sales": 15000,
    "today_transactions": 25,
    "last_sale_at": "2026-08-19T15:30:00Z",
    "recent_sales": [...]
  }
}
```

---

### Cash Sessions

#### List Cash Sessions
```http
GET /api/cash-sessions
Authorization: Bearer <token>
```

**Query Parameters:**
- `terminal_id` - Filter by terminal
- `status` - Filter by status (open/closed)

#### Open Cash Session
```http
POST /api/cash-sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "terminal_id": "uuid",
  "opening_cash": 5000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "terminal_id": "uuid",
      "opening_cash": 5000,
      "status": "open",
      "opened_at": "2026-08-19T08:00:00Z",
      "cashier_id": "uuid"
    }
  }
}
```

#### Close Cash Session
```http
PUT /api/cash-sessions/:id/close
Authorization: Bearer <token>
Content-Type: application/json

{
  "actual_cash": 25000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "opening_cash": 5000,
      "expected_cash": 21450,
      "actual_cash": 25000,
      "difference": 550,
      "status": "closed",
      "closed_at": "2026-08-19T17:00:00Z"
    }
  }
}
```

#### Get Active Session
```http
GET /api/cash-sessions/active?terminal_id=uuid
Authorization: Bearer <token>
```

---

### Sales

#### List Sales
```http
GET /api/sales
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `search` - Search receipt number
- `status` - Filter by status
- `terminal_id` - Filter by terminal
- `start_date` - Filter start date
- `end_date` - Filter end date

**Response:**
```json
{
  "success": true,
  "data": {
    "sales": [
      {
        "id": "uuid",
        "receipt_number": "RCT-0001245",
        "customer_id": "uuid",
        "user_id": "uuid",
        "terminal_id": "uuid",
        "subtotal": 3500,
        "discount": 0,
        "tax": 0,
        "total": 3500,
        "status": "completed",
        "created_at": "2026-08-19T14:30:00Z",
        "customers": { "name": "John Doe" },
        "users": { "full_name": "Chris" },
        "terminals": { "terminal_code": "POS-01" },
        "payments": [{ "method": "cash" }],
        "sale_items": [...]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "total_pages": 8
    }
  }
}
```

#### Create Sale (Checkout)
```http
POST /api/sales
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    {
      "product_id": "uuid",
      "quantity": 2
    }
  ],
  "customer_id": "uuid",  // optional
  "discount": 0,  // optional
  "tax": 0,  // optional
  "payment_method": "cash",
  "terminal_id": "uuid",
  "cash_session_id": "uuid",
  "payment_details": {
    "amount_received": 5000
  }
}
```

**Response (Cash):**
```json
{
  "success": true,
  "data": {
    "sale": { ... },
    "payment": { ... },
    "items": [ ... ],
    "change": 1500
  }
}
```

**Response (M-Pesa/PayHero):**
```json
{
  "success": true,
  "data": {
    "sale": { ... },
    "payment": { ... },
    "items": [ ... ],
    "pending": true
  }
}
```

#### Get Sale Details
```http
GET /api/sales/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "receipt_number": "RCT-0001245",
    "subtotal": 3500,
    "total": 3500,
    "status": "completed",
    "created_at": "2026-08-19T14:30:00Z",
    "customers": { "name": "John Doe" },
    "users": { "full_name": "Chris" },
    "terminals": { "terminal_code": "POS-01" },
    "payments": [
      {
        "method": "cash",
        "amount": 3500,
        "status": "paid"
      }
    ],
    "sale_items": [
      {
        "product_name_snapshot": "USB Cable",
        "quantity": 2,
        "unit_price": 500,
        "subtotal": 1000
      }
    ]
  }
}
```

---

### Reports

#### Sales Report
```http
GET /api/reports/sales
Authorization: Bearer <token>
```

**Query Parameters:**
- `start_date` - Start date (ISO format)
- `end_date` - End date (ISO format)
- `terminal_id` - Filter by terminal

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_sales": 94700,
      "total_transactions": 84,
      "average_sale": 1127
    },
    "by_terminal": [
      {
        "terminal_code": "POS-01",
        "sales": 45000,
        "transactions": 48
      }
    ],
    "by_date": [...]
  }
}
```

#### Payment Methods Report
```http
GET /api/reports/payment-methods
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cash": 31200,
    "mpesa": 48500,
    "payhero": 15000,
    "total": 94700
  }
}
```

#### Profit Report
```http
GET /api/reports/profit
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "revenue": 94700,
    "cost_of_goods": 61400,
    "gross_profit": 33300,
    "expenses": 8500,
    "net_profit": 24800
  }
}
```

#### Products Report
```http
GET /api/reports/products
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "product_name": "USB Cable",
        "quantity_sold": 45,
        "revenue": 22500,
        "profit": 13500
      }
    ]
  }
}
```

#### Inventory Report
```http
GET /api/reports/inventory
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_stock_value": 450000,
    "low_stock": [
      {
        "name": "USB Cable",
        "stock_quantity": 4,
        "low_stock_threshold": 10
      }
    ]
  }
}
```

#### Expenses Report
```http
GET /api/reports/expenses
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 8500,
    "by_category": {
      "Rent": 5000,
      "Utilities": 2000,
      "Supplies": 1500
    }
  }
}
```

---

### Products

#### List Products
```http
GET /api/products
Authorization: Bearer <token>
```

#### Create Product
```http
POST /api/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "USB Cable",
  "sku": "USB-001",
  "barcode": "123456789",
  "category_id": "uuid",
  "buying_price": 300,
  "selling_price": 500,
  "stock_quantity": 100,
  "low_stock_threshold": 10
}
```

#### Update Product
```http
PUT /api/products/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "selling_price": 550,
  "stock_quantity": 95
}
```

#### Delete Product
```http
DELETE /api/products/:id
Authorization: Bearer <token>
```

---

### Customers

#### List Customers
```http
GET /api/customers
Authorization: Bearer <token>
```

#### Create Customer
```http
POST /api/customers
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "254712345678"
}
```

---

### Expenses

#### List Expenses
```http
GET /api/expenses
Authorization: Bearer <token>
```

#### Create Expense
```http
POST /api/expenses
Authorization: Bearer <token>
Content-Type: application/json

{
  "category": "Rent",
  "amount": 5000,
  "description": "Monthly shop rent",
  "date": "2026-08-19"
}
```

---

### Inventory

#### List Inventory Movements
```http
GET /api/inventory
Authorization: Bearer <token>
```

#### Get Low Stock Products
```http
GET /api/inventory/low-stock
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "uuid",
        "name": "USB Cable",
        "stock_quantity": 4,
        "low_stock_threshold": 10
      }
    ]
  }
}
```

#### Adjust Stock
```http
POST /api/inventory/adjust
Authorization: Bearer <token>
Content-Type: application/json

{
  "product_id": "uuid",
  "adjustment": -5,
  "reason": "Damaged items",
  "notes": "5 units found damaged"
}
```

---

### Receipts

#### Get Receipt HTML
```http
GET /api/receipts/:receipt_number/html
Authorization: Bearer <token>
```

Returns HTML for printing receipt.

---

### Webhooks

#### M-Pesa Callback
```http
POST /api/webhooks/mpesa
Content-Type: application/json

{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "...",
      "CheckoutRequestID": "...",
      "ResultCode": 0,
      "ResultDesc": "Success",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount", "Value": 1000 },
          { "Name": "MpesaReceiptNumber", "Value": "QHK7X9YZ4P" }
        ]
      }
    }
  }
}
```

#### PayHero Callback
```http
POST /api/webhooks/payhero
Content-Type: application/json

{
  "reference": "...",
  "status": "completed",
  "amount": 1000,
  "provider_reference": "..."
}
```

---

## Error Responses

### Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Cart cannot be empty"
  }
}
```

### Insufficient Stock
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Insufficient stock for USB Cable. Available: 2"
  }
}
```

### Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Sale not found"
  }
}
```

### Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid token"
  }
}
```

---

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Authentication**: 10 requests per minute
- **General API**: 100 requests per minute
- **Sales**: 30 requests per minute

---

## Pagination

List endpoints support pagination:

```http
GET /api/sales?page=1&limit=20
```

Response includes:
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

---

## Filtering

Most list endpoints support filtering:

```http
GET /api/sales?status=completed&terminal_id=uuid&start_date=2026-08-01&end_date=2026-08-31
```

---

## Sorting

Results are sorted by `created_at` by default (newest first). Some endpoints support additional sorting.
