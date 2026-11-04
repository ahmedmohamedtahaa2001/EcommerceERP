# Supabase Setup Guide

This guide will help you set up Supabase for the Operix ERP system.

## Step 1: Create Supabase Project

1. Go to [Supabase](https://supabase.com)
2. Click "New Project"
3. Fill in:
   - Project Name: `operix-erp`
   - Database Password: (save this securely)
   - Region: Choose closest to you
4. Click "Create new project"
5. Wait for project to initialize (5-10 minutes)

## Step 2: Get API Keys

1. Go to Settings → API
2. Copy these values to `.env.local`:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`

## Step 3: Initialize Database Schema

1. Go to Supabase → SQL Editor
2. Click "New Query"
3. Copy content from `db/migrations/001_init_schema.sql`
4. Paste into SQL editor
5. Click "Run" (play button)
6. Verify all tables were created

## Step 4: Seed Sample Data (Optional)

1. Create a new SQL query
2. Copy content from `db/seed.sql`
3. Paste and run
4. You'll now have sample data to work with

## Step 5: Enable Row-Level Security (RLS)

1. Go to Authentication → Policies
2. For each table, enable RLS:
   - Enable RLS toggle
   - Create policy: "Enable read access for authenticated users"
   - Create policy: "Enable write access for authenticated users"

## Step 6: Setup Authentication

1. Go to Authentication → Providers
2. Enable "Email"
3. Set email redirect to: `http://localhost:3000/auth/callback`

## Step 7: Environment Variables

Your `.env.local` should look like:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
DATABASE_URL=postgresql://postgres:REDACTED@db.xxxxx.supabase.co:5432/postgres
JWT_SECRET=your-jwt-secret-here
```

## Step 8: Test Connection

Run:
```bash
npm install
npm run dev
```

Try to create a user and verify connection works.

## Troubleshooting

**"Failed to fetch user"**: Check that environment variables are correct

**"CORS error"**: Verify your API URL is in Supabase CORS settings

**"Table doesn't exist"**: Run the SQL migration again from SQL Editor

## Useful Supabase Features

- **SQL Editor**: Write and run SQL queries directly
- **Table Editor**: GUI for managing data
- **Realtime**: Automatic subscriptions to changes
- **Auth**: Built-in user authentication
- **Storage**: File uploads
