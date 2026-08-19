# Quick Start Guide

Get the Multi-Terminal POS System running in 5 minutes.

## Prerequisites

- Node.js 18+
- A Supabase account (free tier works)

## Step 1: Clone & Install

```bash
git clone https://github.com/learninghub44/single-multi-terminal-pos.git
cd single-multi-terminal-pos/backend
npm install
```

## Step 2: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Enter:
   - Name: `pos-system`
   - Database password: (choose one)
   - Region: Closest to you
4. Wait ~2 minutes for setup

## Step 3: Get API Keys

In your Supabase dashboard:

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** (looks like `https://xyz.supabase.co`)
   - **anon public** key
   - **service_role** key

## Step 4: Configure Backend

Create `backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
JWT_SECRET=my-super-secret-key-123
```

## Step 5: Setup Database

In Supabase dashboard:

1. Go to **SQL Editor**
2. Click **New query**
3. Paste the contents of `database/migration_multi_terminal.sql`
4. Click **Run**

## Step 6: Create Admin User

In Supabase dashboard:

1. Go to **Authentication** → **Users**
2. Click **Add user**
3. Enter email and password
4. Go to **Table Editor** → **users**
5. Find your user and set `role` to `owner`

## Step 7: Start Server

```bash
cd backend
npm run dev
```

Server starts at `http://localhost:8787`

## Step 8: Open Frontend

Open `frontend/index.html` in your browser (or use a static server):

```bash
cd frontend
npx serve .
```

## Step 9: Login & Test

1. Go to `http://localhost:3000`
2. Login with your admin credentials
3. Go to **Terminals** and create a terminal:
   - Code: `POS-01`
   - Name: `Counter 1`
4. Go to **Products** and add some items
5. Go to **POS** and test a sale!

## Done! 🎉

You now have a working multi-terminal POS system.

## Common Issues

### "Invalid API key" Error

Check your `.env` file has the correct Supabase URL and keys.

### Database Connection Error

Make sure you ran the migration SQL in Supabase SQL Editor.

### CORS Error

Check that your frontend URL is allowed. For local development, `http://localhost:3000` should work.

## Next Steps

- Read the [API Documentation](./api.md)
- Learn about the [Architecture](./architecture.md)
- Check out [Deployment Guide](./installation.md#production-deployment)
