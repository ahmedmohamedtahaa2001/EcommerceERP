# Operix ERP - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Start the Dev Server

```bash
cd /Users/ahmedaboelsnoon/Desktop/PROjects/ERP
npm run dev
```

Server runs on: **http://localhost:3001**

### 2. Login to Dashboard

- URL: http://localhost:3001/auth/login
- Email: `admin@test.local`
- Password: `ChangeMe#2026`

### 3. Explore the System

#### Main Dashboard

- http://localhost:3001/dashboard
- View metrics and quick actions

#### Agent Console

- http://localhost:3001/dashboard/agents
- Send tasks to 4 AI agents
- View responses and memory

#### Inventory Management

- http://localhost:3001/dashboard/inventory
- View, create, and manage inventory
- API: `GET/POST /api/inventory`

---

## 🤖 Using the Agents

### What Are Agents?

4 specialized Claude AI agents that help design your ERP:

1. **Backend Agent** - REST APIs, business logic
2. **Frontend Agent** - React components, UI/UX
3. **Database Agent** - Queries, optimization
4. **DevOps Agent** - Deployment, monitoring

### How to Use

1. Go to http://localhost:3001/dashboard/agents
2. Select an agent
3. Type a task
4. Get AI-powered recommendations

### Example Tasks

```
Backend: "Design an inventory API endpoint with pagination"
Frontend: "Create a component for stock level display"
Database: "Write optimized query for low-stock products"
DevOps: "Setup monitoring for inventory changes"
```

### Activate Agent System

Add to `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-[your-api-key]
```

Get key from: https://console.anthropic.com/

---

## 🗄️ Using the Database

### Architecture

- **Database**: Supabase PostgreSQL
- **URL**: https://nhalhrwoiyqurndsbujz.supabase.co
- **Keys**: Already in `.env.local`

### Tables

- `organizations` - Companies
- `users` - Team members
- `roles` - Admin, Manager, User
- `products` - Catalog
- `warehouses` - Storage locations
- `inventory` - Stock levels
- `stock_movements` - History
- `orders` - Orders
- `customers` - Clients
- `audit_logs` - Activity log

### Set Up Security (RLS)

1. Open Supabase dashboard
2. Go to SQL Editor
3. Run SQL from `RLS_POLICIES.md`
4. Enables organization data isolation

---

## 📡 API Endpoints

### Inventory API

```bash
# List all inventory
GET /api/inventory

# Create inventory
POST /api/inventory
Body: { productId, warehouseId, quantity, reorderLevel }

# Adjust stock
POST /api/inventory/adjust
Body: { inventoryId, quantity, reason }

# Transfer between warehouses
POST /api/inventory/transfer
Body: { fromInventoryId, toInventoryId, quantity }

# Get stock movements
GET /api/inventory/movements
```

### Authentication API

```bash
# Login
POST /api/auth/login
Body: { email, password }

# Logout
GET /auth/logout

# Register
POST /auth/register
Body: { email, password }
```

### Agents API

```bash
# Send task to agent
POST /api/agents
Body: {
  task: "Design inventory API",
  agent: "backend",
  sessionId: "session-001"
}
```

---

## 📁 Project Structure

```
/app
  /auth              - Login, register pages
  /api               - REST API routes
    /agents          - Agent communication
    /inventory       - Stock management API
    /products        - Catalog API
    /orders          - Order API
    /customers       - Customer API
  /(dashboard)       - Protected pages
    /dashboard       - Main dashboard
    /inventory       - Inventory UI
    /products        - Products UI
    /agents          - Agent console
    /orders          - Orders UI
    /customers       - Customers UI

/lib
  /agents            - AI agent system
    config.ts        - Agent definitions
    orchestrator.ts  - Task routing
    memory.ts        - Memory system
  /supabase.ts       - Database client

/components
  /AgentConsole.tsx  - Agent UI component
  /DashboardLayout   - Layout components
```

---

## 🔐 Security

### Authentication

- Email + password via Supabase
- HTTP-only cookies
- Middleware protection
- Session-based access

### Data Isolation

- Organization-level RLS (Row Level Security)
- Users see only their org data
- Admin users can manage org
- Service role for API automation

### What's Protected

- All dashboard routes require login
- API routes check organization_id
- Database enforces RLS policies
- Audit logs track all changes

---

## ✅ Checklist for First Use

- [ ] Run `npm run dev`
- [ ] Login with admin@test.local
- [ ] Visit /dashboard to see metrics
- [ ] Go to /dashboard/agents
- [ ] (Optional) Add ANTHROPIC_API_KEY for agents
- [ ] Apply RLS policies from RLS_POLICIES.md
- [ ] Create demo data in Supabase
- [ ] Test inventory API with curl or Postman
- [ ] Create products, warehouses, customers

---

## 🐛 Troubleshooting

### Login Not Working

- Check credentials: admin@test.local / ChangeMe#2026
- Verify .env.local has Supabase keys
- Restart dev server: `npm run dev`

### Agents Not Responding

- Add ANTHROPIC_API_KEY to .env.local
- Restart dev server
- Check browser console for errors

### Database Queries Failing

- Verify RLS policies are applied
- Check organization_id in user record
- Ensure demo data exists

### Port Already in Use

Dev server uses port 3001 (not 3000)
If that's busy:

```bash
lsof -i :3001
kill -9 <PID>
```

---

## 📚 Documentation Files

| File                        | Purpose                          |
| --------------------------- | -------------------------------- |
| CLAUDE.md                   | Project architecture & standards |
| AGENTS_SETUP.md             | How to use agent system          |
| RLS_POLICIES.md             | Security setup guide             |
| PROJECT_ANALYSIS.md         | Complete project overview        |
| IMPLEMENTATION_CHECKLIST.md | Next steps & timeline            |
| QUICK_START.md              | This file                        |

---

## 🎯 Next Steps

### Today (5 mins)

1. Start dev server
2. Login to dashboard
3. Explore agent console

### This Hour (1 hour)

1. Add ANTHROPIC_API_KEY
2. Test agent system
3. Review API responses

### This Week (4-8 hours)

1. Apply RLS policies
2. Create demo data
3. Test inventory API
4. Complete other modules

### This Month (20+ hours)

1. Complete CRUD for all modules
2. Performance optimization
3. Deploy to production
4. Advanced features (semantic memory, workflows)

---

## 💬 Support

### Quick Links

- **Supabase**: https://nhalhrwoiyqurndsbujz.supabase.co
- **GitHub**: Your project repo
- **Docs**: See CLAUDE.md

### Common Questions

**Q: How do I add more users?**
A: Add them to Supabase Auth, then create user records in `users` table

**Q: Can I change the organization?**
A: Each user belongs to one organization (organization_id). Use RLS to isolate.

**Q: How do I see data in the database?**
A: Use Supabase dashboard → Table Editor, or SQL Editor for queries

**Q: What's the difference between Auth and Users table?**
A: Auth is Supabase authentication. Users table stores organization mapping.

**Q: How do I deploy to production?**
A: Use Vercel + Supabase. See IMPLEMENTATION_CHECKLIST.md

---

## 🎉 You're Ready!

Your Operix ERP is now ready to use. Start with the agent console to get AI-powered recommendations on how to complete the remaining modules.

**Happy building!** 🚀
