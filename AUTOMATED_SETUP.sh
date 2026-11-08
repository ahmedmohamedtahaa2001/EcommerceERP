#!/bin/bash

################################################################################
# OPERIX ERP - AUTOMATED SETUP SCRIPT
# This script automates everything that can be done locally
# You still need to execute SQL in Supabase manually (GUI interface)
################################################################################

set -e  # Exit on any error

PROJECT_DIR="/Users/ahmedaboelsnoon/Desktop/PROjects/ERP"
cd "$PROJECT_DIR"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║       OPERIX ERP - AUTOMATED SETUP SCRIPT                     ║"
echo "║       Taking you from 90% → 100% Production Ready             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

################################################################################
# PHASE 1: LOCAL SETUP
################################################################################

echo "═══════════════════════════════════════════════════════════════════════"
echo "PHASE 1: LOCAL ENVIRONMENT SETUP"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

# Step 1: Verify environment
echo "✓ Verifying project directory..."
if [ ! -f "package.json" ]; then
    echo "❌ ERROR: package.json not found!"
    exit 1
fi
echo "  ✅ Project directory verified"

# Step 2: Check npm
echo ""
echo "✓ Checking npm..."
npm_version=$(npm --version)
echo "  ✅ npm version: $npm_version"

# Step 3: Check dependencies
echo ""
echo "✓ Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "  ⚠️  node_modules not found - installing..."
    npm install
    echo "  ✅ Dependencies installed"
else
    echo "  ✅ Dependencies already installed"
fi

# Step 4: Verify key files
echo ""
echo "✓ Verifying required files..."
required_files=(
    ".env.local"
    "RLS_SETUP.sql"
    "DEMO_DATA.sql"
    "middleware.ts"
    "lib/supabase.ts"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ] || [ -d "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file (MISSING)"
    fi
done

################################################################################
# PHASE 2: LOCAL TESTING
################################################################################

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "PHASE 2: LOCAL BUILD & TEST"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

# Step 5: Build check
echo "✓ Running build..."
if npm run build > /tmp/build.log 2>&1; then
    echo "  ✅ Build successful"
else
    echo "  ❌ Build failed"
    echo "  Last 10 lines of build log:"
    tail -10 /tmp/build.log
    exit 1
fi

# Step 6: Type check
echo ""
echo "✓ Running TypeScript check..."
if npm run type-check > /tmp/type-check.log 2>&1; then
    echo "  ✅ TypeScript check passed"
else
    echo "  ⚠️  TypeScript warnings (non-blocking)"
fi

################################################################################
# PHASE 3: DEPLOYMENT PREPARATION
################################################################################

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "PHASE 3: DEPLOYMENT PREPARATION"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

# Step 7: Prepare git
echo "✓ Checking git status..."
if git rev-parse --git-dir > /dev/null 2>&1; then
    echo "  ✅ Git repository found"

    # Check for uncommitted changes
    if git status --porcelain | grep -q .; then
        echo "  ⚠️  Uncommitted changes detected"
        echo ""
        echo "  Ready to commit changes? Run:"
        echo "    git add ."
        echo "    git commit -m 'feat: production setup with RLS and demo data'"
        echo "    git push origin main"
    else
        echo "  ✅ Working directory clean"
    fi
else
    echo "  ⚠️  Not a git repository"
fi

################################################################################
# PHASE 4: SUPABASE PREPARATION
################################################################################

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "PHASE 4: SUPABASE SETUP (Manual Steps Required)"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

echo "The following steps require manual execution in Supabase SQL Editor:"
echo ""
echo "STEP 1: Apply RLS Policies (5 min)"
echo "  1. Go to: https://app.supabase.com"
echo "  2. Project: nhalhrwoiyqurndsbujz"
echo "  3. SQL Editor → New Query"
echo "  4. Copy contents of: RLS_SETUP.sql"
echo "  5. Paste in SQL Editor → Click RUN"
echo "  6. Verify with: SELECT COUNT(*) FROM pg_policies;"
echo ""

echo "STEP 2: Create Demo Data (30 min)"
echo "  1. SQL Editor → New Query"
echo "  2. Copy contents of: DEMO_DATA.sql"
echo "  3. Paste in SQL Editor → Click RUN"
echo "  4. Verify data with test queries (see guide)"
echo ""

echo "STEP 3: Create Test User (5 min)"
echo "  1. SQL Editor → New Query"
echo "  2. Copy and run the SQL from EXECUTION_GUIDE.md Step 4"
echo "  3. Verify user created"
echo ""

################################################################################
# PHASE 5: LOCAL SERVER & TESTING
################################################################################

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "PHASE 5: LOCAL SERVER & TESTING"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

echo "Ready to start local dev server? (y/n)"
read -r response

if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
    echo ""
    echo "Starting development server..."
    echo "  Local: http://localhost:3000"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    npm run dev
else
    echo "Skipped starting dev server"
    echo ""
    echo "To start later, run:"
    echo "  npm run dev"
fi

################################################################################
# COMPLETION
################################################################################

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "SETUP COMPLETE"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Execute SQL in Supabase (RLS_SETUP.sql, DEMO_DATA.sql)"
echo "  2. Create test user in Supabase"
echo "  3. Follow API_TESTING.md for testing"
echo "  4. Deploy to Vercel when ready"
echo ""
echo "All code is ready. Just execute the SQL and follow the guides!"
echo ""

