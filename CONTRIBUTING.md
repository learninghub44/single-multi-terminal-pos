# Contributing to POS System

Thank you for your interest in contributing! This document provides guidelines and information about contributing to this project.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- Git
- Supabase account
- Cloudflare account (for deployment)

### Development Setup

1. **Fork the repository**
   ```bash
   git clone https://github.com/your-username/single-multi-terminal-pos.git
   cd single-multi-terminal-pos
   ```

2. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

## Development Workflow

### Branch Naming

Use descriptive branch names with prefixes:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Adding tests

Example:
```bash
git checkout -b feature/add-offline-mode
```

### Commit Messages

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting, no code change
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `test` - Adding tests
- `chore` - Maintenance

Examples:
```bash
feat(pos): add offline mode support
fix(api): resolve race condition in stock deduction
docs(readme): update installation instructions
```

### Code Style

#### TypeScript/JavaScript

- Use TypeScript for backend code
- Use vanilla JavaScript for frontend (no framework)
- Follow ESLint configuration
- Use meaningful variable names
- Add JSDoc comments for public functions

```typescript
/**
 * Deducts stock atomically using row locking
 * @param productId - The product to deduct from
 * @param quantity - Amount to deduct
 * @returns Success status
 */
async function deductStockAtomically(productId: string, quantity: number): Promise<boolean> {
  // Implementation
}
```

#### CSS

- Use CSS custom properties for theming
- Follow BEM naming convention
- Keep selectors flat and specific
- Document component styles

```css
/* Card Component */
.card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```

### Testing

#### Manual Testing

Before submitting a PR, test:

1. **Authentication** - Login/logout with all roles
2. **Terminal Flow** - Select terminal, open session, process sale
3. **Payments** - Cash, M-Pesa, PayHero
4. **Concurrency** - Multiple terminals selling same product
5. **Responsive** - Desktop, tablet, mobile views
6. **Theme** - Light and dark mode

#### Test Scenarios

```bash
# Test concurrent sales
# Terminal A
curl -X POST /api/sales \
  -H "Authorization: Bearer <token-a>" \
  -d '{"items":[{"product_id":"...","quantity":1}],"payment_method":"cash","terminal_id":"<terminal-a>"}'

# Terminal B (simultaneous)
curl -X POST /api/sales \
  -H "Authorization: Bearer <token-b>" \
  -d '{"items":[{"product_id":"...","quantity":1}],"payment_method":"cash","terminal_id":"<terminal-b>"}'
```

### Pull Request Process

1. **Update documentation** if needed
2. **Add screenshots** for UI changes
3. **Test thoroughly** on multiple devices
4. **Write clear PR description**

#### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested on desktop
- [ ] Tested on tablet
- [ ] Tested on mobile
- [ ] Tested light/dark theme
- [ ] Tested concurrent access

## Screenshots
[Add screenshots if applicable]

## Checklist
- [ ] Code follows project style
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings
```

## Project Structure

```
pos/
├── backend/                # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts       # Entry point
│   │   ├── types/         # TypeScript types
│   │   ├── middleware/     # Auth, validation
│   │   ├── routes/        # API endpoints
│   │   └── services/      # External services
│   └── wrangler.toml      # Cloudflare config
├── frontend/               # Vanilla JS SPA
│   ├── css/               # Stylesheets
│   └── js/                # JavaScript
│       ├── pages/         # Page components
│       └── components/    # Reusable components
└── database/               # SQL migrations
```

## Key Concepts

### Multi-Terminal Architecture

- Single business, multiple POS terminals
- Shared database, inventory, and user base
- Atomic operations prevent race conditions
- Terminal validation on every transaction

### Atomic Stock Deduction

```sql
-- Uses FOR UPDATE to lock rows during deduction
SELECT deduct_stock_atomically(p_product_id, p_quantity);
```

### Receipt Number Generation

```sql
-- Uses advisory locks for unique numbers
SELECT generate_receipt_number();
```

## Reporting Issues

### Bug Reports

Include:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Browser/device info
5. Screenshots if applicable

### Feature Requests

Include:
1. Problem description
2. Proposed solution
3. Alternatives considered
4. Additional context

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Maintain professional communication

## Questions?

Open an issue or reach out to the maintainers.

Thank you for contributing!
