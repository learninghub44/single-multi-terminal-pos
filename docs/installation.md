# Installation Guide

This guide will help you set up the Multi-Terminal POS System for development or production.

## Prerequisites

### Required

- **Node.js** 18 or higher ([Download](https://nodejs.org/))
- **Git** ([Download](https://git-scm.com/))
- **Supabase Account** ([Sign up](https://supabase.com/))

### Optional

- **Cloudflare Account** (for production deployment)
- **M-Pesa Daraja API** credentials
- **PayHero API** credentials

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/learninghub44/single-multi-terminal-pos.git
cd single-multi-terminal-pos
```

### 2. Backend Setup

```bash
cd backend
npm install
```

### 3. Create Environment File

Create `backend/.env`:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key

# M-Pesa Configuration (optional)
MPESA_CONSUMER_KEY=your-mpesa-consumer-key
MPESA_CONSUMER_SECRET=your-mpesa-consumer-secret
MPESA_SHORTCODE=your-business-shortcode
MPESA_PASSKEY=your-passkey
MPESA_CALLBACK_URL=https://your-domain.com/api/webhooks/mpesa

# PayHero Configuration (optional)
PAYHERO_API_KEY=your-payhero-api-key
PAYHERO_WEBHOOK_URL=https://your-domain.com/api/webhooks/payhero
```

### 4. Database Setup

#### Option A: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `database/migration_multi_terminal.sql`
4. Click "Run" to execute the migration

#### Option B: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Run migration
supabase db push
```

### 5. Start Development Server

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend (optional, if not using backend proxy)
cd frontend
npx serve .
```

### 6. Access the Application

Open your browser and navigate to:

- **Frontend**: `http://localhost:3000` (or your static server URL)
- **Backend API**: `http://localhost:8787/api`

## Detailed Setup

### Supabase Configuration

#### Creating a New Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Enter project details:
   - Project name: `pos-system`
   - Database password: (choose a strong password)
   - Region: Choose closest to your users
4. Wait for project to be created

#### Getting API Keys

1. In your project dashboard, go to Settings → API
2. Copy the following:
   - **Project URL** (e.g., `https://xyzcompany.supabase.co`)
   - **anon public** key
   - **service_role** key (keep this secret!)

#### Running the Migration

1. Go to SQL Editor in your Supabase dashboard
2. Create a new query
3. Paste the contents of `database/migration_multi_terminal.sql`
4. Click "Run" or press Ctrl+Enter

The migration will create:
- `terminals` table
- `cash_sessions` table
- `terminal_id` columns on existing tables
- `deduct_stock_atomically()` function
- `generate_receipt_number()` function
- Indexes for performance
- RLS policies for security

### Backend Configuration

#### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `JWT_SECRET` | Secret for JWT signing | Yes |
| `MPESA_CONSUMER_KEY` | M-Pesa API key | No |
| `MPESA_CONSUMER_SECRET` | M-Pesa API secret | No |
| `MPESA_SHORTCODE` | M-Pesa business shortcode | No |
| `MPESA_PASSKEY` | M-Pesa API passkey | No |
| `PAYHERO_API_KEY` | PayHero API key | No |

#### Generating JWT Secret

```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
-[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Random -Minimum 1000000000)))
```

### Frontend Configuration

Edit `frontend/js/config.js`:

```javascript
const CONFIG = {
  API_BASE: '/api',  // Change to your backend URL in production
  CURRENCY: 'KES',   // Your currency code
  TIMEZONE: 'Africa/Nairobi',  // Your timezone
  RECEIPT_SIZE: '80mm'  // 58mm or 80mm
};
```

## Production Deployment

### Cloudflare Workers

1. **Install Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**
   ```bash
   wrangler login
   ```

3. **Configure wrangler.toml**
   ```toml
   name = "pos-system"
   main = "src/index.ts"
   compatibility_date = "2024-01-01"

   [vars]
   ENVIRONMENT = "production"

   [env.production]
   vars = { ENVIRONMENT = "production" }
   ```

4. **Set Secrets**
   ```bash
   wrangler secret put SUPABASE_URL
   wrangler secret put SUPABASE_SERVICE_KEY
   wrangler secret put JWT_SECRET
   # ... other secrets
   ```

5. **Deploy**
   ```bash
   cd backend
   npm run deploy
   ```

### Custom Domain

1. Add your domain in Cloudflare Workers dashboard
2. Update CORS_ORIGIN environment variable
3. Configure DNS records

### Frontend Deployment

The frontend is static files and can be deployed to:

- **Cloudflare Pages**
- **Netlify**
- **Vercel**
- **Any static hosting**

Example with Cloudflare Pages:
```bash
# In frontend directory
npx wrangler pages deploy . --project-name=pos-frontend
```

## Initial Setup After Deployment

### 1. Create Admin User

After deploying, you need to create an initial admin user. You can do this via:

#### Option A: Supabase Dashboard

1. Go to Authentication → Users
2. Click "Add User"
3. Enter email and password
4. Go to Table Editor → users table
5. Update the user's role to 'owner'

#### Option B: API Call

```bash
curl -X POST https://your-api.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourbusiness.com",
    "password": "secure-password",
    "full_name": "Admin User",
    "role": "owner"
  }'
```

### 2. Create Terminals

1. Login as owner
2. Go to Settings → Terminals
3. Create your POS terminals:
   - Terminal Code: `POS-01`
   - Name: `Counter 1`
   - Location: `Main entrance`

### 3. Add Products

1. Go to Products
2. Add your inventory items
3. Set prices and stock levels

### 4. Test the Flow

1. Login as cashier
2. Select a terminal
3. Open a cash session
4. Process a test sale
5. Close the cash session

## Troubleshooting

### Common Issues

#### "Invalid API key" Error

- Check your Supabase URL and keys in `.env`
- Ensure you're using the correct keys (service_role for backend)

#### Database Connection Error

- Verify your Supabase project is active
- Check if your IP is allowed (if using IP restrictions)
- Ensure database is not paused (free tier pauses after inactivity)

#### CORS Errors

- Check CORS_ORIGIN environment variable
- Ensure frontend URL is whitelisted
- For development, use `http://localhost:3000`

#### Receipt Numbers Not Sequential

- This can happen if `generate_receipt_number()` fails
- Check database logs for errors
- Ensure the function was created by the migration

### Getting Help

1. Check the [README](../README.md) for general information
2. Review [API Documentation](./api.md) for endpoint details
3. Open an issue on GitHub
4. Contact support

## Next Steps

After installation:

1. [Read the API Documentation](./api.md)
2. [Understand the Architecture](./architecture.md)
3. [Review Security Practices](./security.md)
4. [Join the Community](../CONTRIBUTING.md)

---

**Note**: For production use, ensure you:
- Use strong passwords and secrets
- Enable HTTPS
- Set up proper backups
- Monitor application logs
- Regular security updates
