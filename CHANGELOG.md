# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-19

### Added

#### Core Features
- Multi-terminal POS support with shared database
- Atomic inventory deduction using PostgreSQL `FOR UPDATE` row locking
- Unique receipt number generation with advisory locks
- Real-time stock validation on every transaction

#### Terminal Management
- Terminal CRUD operations (create, read, update, delete)
- Terminal activation/deactivation
- Terminal performance tracking
- Terminal-aware transaction logging

#### Cash Management
- Cash session opening with opening cash amount
- Cash session closing with actual cash counting
- Expected vs actual cash tracking
- Cash session history

#### Payment Processing
- Cash payments with change calculation
- M-Pesa STK Push integration
- PayHero mobile payment integration
- Payment status tracking

#### Dashboard
- Premium dark/light theme with persistent preference
- Real-time business metrics
- Today's sales, transactions, and average sale
- Payment method breakdown with visual bars
- Terminal performance comparison
- Recent transactions table
- Quick actions (New Sale, Add Product, etc.)
- Cash session status
- Low stock alerts
- Financial overview (Revenue, COGS, Expenses, Profit)
- Top products ranked list

#### Sales
- Complete sales history with pagination
- Terminal and date range filtering
- Sale details modal with items and payment info
- Receipt printing support

#### Products
- Product catalog management
- Category support
- Stock tracking with low stock alerts
- Product search and filtering

#### Inventory
- Stock level monitoring
- Low stock alerts
- Inventory movements audit trail
- Stock adjustment support

#### Customers
- Customer database
- Customer purchase history
- Customer search

#### Expenses
- Expense tracking by category
- Daily/weekly/monthly reports
- Expense summaries

#### Reports
- Sales reports by terminal, date, payment method
- Payment method breakdown
- Profit analysis
- Top selling products
- Inventory status
- Expense summaries

#### User Management
- Role-based access control (Owner, Manager, Cashier)
- User CRUD operations
- Permission management

#### Settings
- Business profile configuration
- Tax settings
- Receipt customization

### Technical

#### Backend
- Cloudflare Workers with Hono framework
- Supabase PostgreSQL database
- TypeScript with strict mode
- RESTful API design
- JWT authentication
- Atomic database operations
- Audit logging

#### Frontend
- Vanilla JavaScript SPA
- CSS custom properties for theming
- Responsive design (desktop, tablet, mobile)
- Keyboard scanner support
- Receipt printing
- Theme switching (light/dark)

#### Database
- PostgreSQL with Supabase
- Row Level Security policies
- Atomic stock deduction function
- Receipt number generation function
- Comprehensive indexing
- Audit trail tables

### Security
- JWT-based authentication
- Server-side validation on all inputs
- Atomic database operations
- Row-level security policies
- Terminal validation on every sale
- Audit logging for all transactions

### Performance
- Atomic operations prevent race conditions
- Optimistic UI with rollback on error
- Minimal data transfer
- CDN delivery for static assets
- Connection pooling via Supabase

## [0.9.0] - 2026-08-18

### Added
- Initial multi-terminal architecture
- Terminal selection flow
- Cash session management
- Terminal-aware sales processing

### Changed
- Updated database schema for multi-terminal support
- Modified API endpoints to accept terminal_id
- Updated frontend to send terminal context

## [0.8.0] - 2026-08-17

### Added
- Payment processing (Cash, M-Pesa, PayHero)
- Receipt generation
- Basic reporting

### Fixed
- Stock deduction race condition
- Receipt number uniqueness

## [0.7.0] - 2026-08-16

### Added
- Product management
- Inventory tracking
- Customer management
- Basic POS interface

## [0.6.0] - 2026-08-15

### Added
- User authentication
- Role-based access control
- Basic dashboard

## [0.5.0] - 2026-08-14

### Added
- Initial project setup
- Database schema
- Basic API structure

---

## Version History

- **1.0.0** - Production release with full multi-terminal support
- **0.9.0** - Multi-terminal beta
- **0.8.0** - Payment processing
- **0.7.0** - Core POS features
- **0.6.0** - Authentication and users
- **0.5.0** - Initial setup

## Upgrade Guide

### From 0.9.x to 1.0.0

1. Run database migration:
   ```sql
   -- Run migration_multi_terminal.sql
   ```

2. Update environment variables:
   ```env
   # Add any new required variables
   ```

3. Redeploy backend:
   ```bash
   cd backend
   npm run deploy
   ```

4. Clear browser cache for frontend updates

### From 0.8.x to 0.9.0

1. Run database migration for terminal tables
2. Update API endpoints to include terminal_id
3. Update frontend terminal selection flow

---

## Support

For issues and questions:
- Open an issue on GitHub
- Check the README for documentation
- Review CONTRIBUTING.md for development guidelines
