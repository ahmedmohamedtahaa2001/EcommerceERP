# 🚀 QUICK START GUIDE

**System Status:** ✅ Production Ready  
**Version:** 1.0 Complete  
**Last Updated:** November 4, 2026

---

## 5-MINUTE SETUP

### Step 1: Clone & Install (2 min)
```bash
cd /Users/ahmedaboelsnoon/Desktop/ERP
npm install
```

### Step 2: Setup Supabase (2 min)
```bash
# Follow guide: /Users/ahmedaboelsnoon/Desktop/ERP/SETUP_SUPABASE.md
# 1. Create Supabase project
# 2. Copy credentials
# 3. Create .env.local with:
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### Step 3: Run Development
```bash
npm run dev
# Visit: http://localhost:3000
```

---

## 30-MINUTE FIRST USE

### Login
```
URL: http://localhost:3000/auth/login
Demo credentials: (create via Supabase)
Email: admin@company.com
Password: (your password)
```

### First Actions
1. **View Dashboard** (1 min)
   - See KPI cards
   - Check recent orders
   - View top products

2. **Add a Product** (3 min)
   - Go to: Products → New Product
   - Fill: SKU, Name, Price, Cost
   - Click: Create

3. **Import Sample Data** (5 min)
   - Go to: Import
   - Download template
   - Fill with sample data
   - Upload CSV

4. **Create an Order** (5 min)
   - Go to: Orders → New Order
   - Step 1: Select customer (or create)
   - Step 2: Add products
   - Step 3: Review & create

5. **View Analytics** (2 min)
   - Check dashboard KPIs
   - View top products
   - See recent orders

6. **Export Data** (5 min)
   - Go to: Export
   - Select data type
   - Choose format
   - Download CSV

7. **Manage Users** (4 min)
   - Go to: Settings → Users
   - Add team member
   - Assign role
   - Share login

---

## DAILY OPERATIONS

### Morning Routine (10 min)
```
1. Dashboard → Check daily metrics
   - Revenue total
   - New orders
   - Pending items
   
2. Orders → Check pending orders
   - Confirm status
   - Update shipments
   
3. Inventory → Check low stock
   - See alerts
   - Plan restocking
```

### During Day (as needed)
```
1. Orders → Create new orders
   - Customer selection
   - Product entry
   - Confirmation

2. Products → Update prices
   - Modify as needed
   - Track changes

3. Customers → View history
   - See past orders
   - Check total spent
   - Update info

4. Search → Find items
   - Use text search
   - Apply filters
   - Sort results
```

### End of Day (10 min)
```
1. Export → Backup data
   - Export all products
   - Export all customers
   - Export all orders

2. Settings → Check alerts
   - Review any issues
   - Note for tomorrow

3. Users → Verify access
   - Check user activity
   - Confirm permissions
```

---

## KEY FEATURES AT A GLANCE

### 🛍️ Products
```
- CRUD: Create, read, update, delete
- SKU tracking
- Price & cost management
- Variants support
- Status tracking (active/inactive)
- Search & filtering
```

### 📦 Orders
```
- Multi-step creation wizard
- Order number auto-generation
- Status workflow
- Payment tracking
- Item-level details
- Customer linked
```

### 👥 Customers
```
- Full contact management
- Multiple addresses
- Order history
- Lifetime value calculation
- Search & filtering
- Activity tracking
```

### 📊 Inventory
```
- Warehouse tracking
- Quantity management
- Reserved items
- Low stock alerts
- Reorder levels
- Valuation
```

### 📈 Analytics
```
- Revenue KPIs
- Top products
- Order trends
- Customer analytics
- Real-time dashboards
```

### 🔧 Admin
```
- User management
- Role assignment
- Settings panel
- API key management
- Audit logs (ready)
- Security config
```

---

## NAVIGATION SHORTCUTS

### From Any Page
```
Logo click           → Go to Dashboard
Sidebar toggle       → Expand/collapse menu
User dropdown        → Profile & Logout
Search bar          → Global search
Settings link       → Admin panel
```

### Main Menu Items
```
📊 Dashboard         → Main overview
🛍️ Products          → Product management
📦 Orders            → Order management
👥 Customers         → Customer management
📈 Inventory         → Stock tracking
📋 Analytics         → Business metrics
⚙️ Settings          → Admin panel
```

---

## COMMON TASKS

### Add a New Product (2 min)
```
1. Products → New Product
2. Fill form:
   - SKU: unique code
   - Name: product name
   - Price: selling price
   - Cost: purchase cost
   - Description: details
3. Click: Create
```

### Create an Order (5 min)
```
1. Orders → New Order
2. Step 1: Select customer
3. Step 2: Add products (set qty)
4. Step 3: Review & confirm
5. Done: Order created
```

### Add a Customer (2 min)
```
1. Customers → New Customer
2. Fill form:
   - Name: customer name
   - Email: contact email
   - Phone: phone number
   - Address: shipping address
3. Click: Create
```

### Import CSV Data (5 min)
```
1. Import page
2. Select data type:
   - Products
   - Customers
3. Upload CSV file
4. Preview data
5. Click: Import
6. See results
```

### Export to CSV (2 min)
```
1. Export page
2. Select type:
   - Products / Customers / Orders / Inventory
3. Choose format:
   - CSV / Excel
4. Select columns
5. Click: Export
6. File downloads
```

### Manage Users (3 min)
```
1. Settings → Users
2. Click: + Add User
3. Fill form:
   - Email
   - Name
   - Role
4. Click: Create
5. Share login info
```

---

## KEYBOARD SHORTCUTS

```
Ctrl/Cmd + K       → Open search
Ctrl/Cmd + /       → Help menu
Escape              → Close modals
Tab                 → Navigate forms
Enter               → Submit forms
Ctrl/Cmd + S       → Quick save (coming)
```

---

## TROUBLESHOOTING

### Can't Login
```
✓ Check email & password
✓ Verify user exists in Settings
✓ Check user is active
✓ Clear browser cache
✓ Check internet connection
```

### Page Won't Load
```
✓ Refresh browser
✓ Check internet
✓ Clear cache
✓ Try different browser
✓ Check console (F12)
```

### Data Not Showing
```
✓ Check filters (remove if applied)
✓ Check search (clear if set)
✓ Refresh page
✓ Check user permissions
✓ Verify data exists
```

### Import Fails
```
✓ Check CSV format
✓ Verify required columns
✓ Check file size < 10MB
✓ Ensure valid data
✓ See error message
```

### Export Not Working
```
✓ Check data exists
✓ Try different browser
✓ Check columns selected
✓ Verify format selected
✓ Check browser settings
```

---

## GETTING HELP

### Documentation
```
📚 See: /sprints/ folder
- first_working_sprint.md   (Foundation)
- SPRINT2_STATUS.md         (Features)
- SPRINT3_STATUS.md         (Advanced)
- FINAL_SUMMARY.md          (Complete overview)
```

### Support
```
📧 Contact: admin@company.com
📞 Phone: +1-xxx-xxx-xxxx
💬 Slack: #erp-support
📖 Wiki: company-wiki/erp
```

### Common Questions
```
Q: How do I add a user?
A: Settings → Users → + Add User

Q: How do I import data?
A: Import page → Upload CSV → Confirm

Q: How do I export data?
A: Export page → Select type → Download

Q: How do I change my password?
A: Settings → Security → Change Password

Q: How do I add a warehouse?
A: Settings → Company → Add Warehouse
```

---

## FEATURES BY USER ROLE

### Admin
```
✅ All features
✅ User management
✅ Settings access
✅ Data import/export
✅ Security config
```

### Manager
```
✅ View all data
✅ Create/edit items
✅ View reports
✅ Export data
❌ User management
```

### Staff
```
✅ View data
✅ Create orders
✅ Edit products
✅ Update inventory
❌ Delete data
```

### Viewer
```
✅ View all data
✅ View reports
✅ Export data
❌ Create/edit
❌ Delete
```

---

## BEST PRACTICES

### Daily
```
✓ Check dashboard each morning
✓ Confirm pending orders
✓ Update inventory as needed
✓ Export data end of day
✓ Review error alerts
```

### Weekly
```
✓ Review sales trends
✓ Check low stock items
✓ Verify user access
✓ Backup all data
✓ Update customer info
```

### Monthly
```
✓ Full data export
✓ Security review
✓ User audit
✓ Performance check
✓ Update company info
```

---

## PERFORMANCE TIPS

### Speed Up
```
✓ Use filters to reduce data
✓ Search instead of scrolling
✓ Limit result set with pagination
✓ Close unused tabs
✓ Clear browser cache monthly
```

### Large Data Sets
```
✓ Use search filters
✓ Use pagination (50 per page)
✓ Export to CSV for analysis
✓ Use bulk import for data
✓ Schedule bulk ops off-peak
```

---

## SECURITY CHECKLIST

### Do This
```
✓ Use strong password (16+ chars)
✓ Don't share your login
✓ Logout when away from desk
✓ Report suspicious activity
✓ Review user access quarterly
✓ Update passwords every 90 days
```

### Don't Do This
```
✗ Share passwords
✗ Use same password as other systems
✗ Leave session open
✗ Export unencrypted data
✗ Give unnecessary permissions
✗ Use production for testing
```

---

## KEYBOARD SHORTCUTS REFERENCE

```
Navigation:
  Ctrl/Cmd + K      → Quick search
  Ctrl/Cmd + /      → Help
  Escape             → Close modal

Forms:
  Tab                → Next field
  Shift + Tab        → Previous field
  Enter              → Submit
  Escape             → Cancel

Data:
  Ctrl/Cmd + E       → Export
  Ctrl/Cmd + I       → Import
  Ctrl/Cmd + F       → Search
  Ctrl/Cmd + R       → Refresh
```

---

## MOBILE USAGE

### Supported Features
```
✅ View dashboard
✅ View products
✅ View orders
✅ View customers
✅ View inventory
✅ Create orders (wizard)
✅ Search & filter
✅ Basic editing
```

### Recommended
```
✓ Use landscape for tables
✓ Use portrait for forms
✓ Tap twice to zoom
✓ Scroll right for full tables
✓ Use mobile-optimized pages
```

---

## API REFERENCE (Coming Soon)

### Endpoints Overview
```
GET    /api/products           → List products
POST   /api/products           → Create product
GET    /api/products/[id]      → Get product
PUT    /api/products/[id]      → Update product
DELETE /api/products/[id]      → Delete product

GET    /api/orders             → List orders
POST   /api/orders             → Create order
GET    /api/orders/[id]        → Get order
PUT    /api/orders/[id]        → Update order

GET    /api/customers          → List customers
POST   /api/customers          → Create customer
```

---

## MAINTENANCE SCHEDULE

### Daily (1 min)
- Check alerts
- Verify uptime

### Weekly (10 min)
- Review logs
- Check backups
- Update products

### Monthly (30 min)
- Full backup
- Security audit
- Performance check
- User review

### Quarterly (1 hour)
- Complete audit
- Performance optimization
- Security review
- System upgrade

---

## NEXT STEPS

### After Setup (Today)
```
1. Create first admin user
2. Add sample products
3. Add sample customers
4. Create first order
5. Explore dashboards
6. Invite team members
```

### Next Week
```
1. Import bulk data
2. Setup warehouses
3. Train staff
4. Establish workflows
5. Test features
```

### Next Month
```
1. Optimize performance
2. Setup integrations
3. Create reports
4. Fine-tune workflows
5. Plan growth
```

---

**Ready to use? Start with `/Users/ahmedaboelsnoon/Desktop/ERP/SETUP_SUPABASE.md`**

**Questions? See `/sprints/FINAL_SUMMARY.md` for complete documentation**

🎉 **Your ERP system is ready for production use!**
