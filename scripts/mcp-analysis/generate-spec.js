/**
 * Comprehensive Specification Generator
 * Reads all analysis files and generates a complete ERP specification
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = './analysis';

function readAnalysisFiles() {
  console.log('📖 Reading analysis files...');

  const files = {
    appExploration: null,
    featureAnalysis: null,
    domStructure: null,
    apiEndpoints: null,
    formsAnalysis: null,
    designTokens: null,
    visualAnalysis: null
  };

  try {
    if (fs.existsSync(path.join(OUTPUT_DIR, 'app-exploration.json'))) {
      files.appExploration = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'app-exploration.json'), 'utf8'));
      console.log('✓ App exploration data loaded');
    }

    if (fs.existsSync(path.join(OUTPUT_DIR, 'feature-analysis.json'))) {
      files.featureAnalysis = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'feature-analysis.json'), 'utf8'));
      console.log('✓ Feature analysis data loaded');
    }

    if (fs.existsSync(path.join(OUTPUT_DIR, 'dom-structure.json'))) {
      files.domStructure = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'dom-structure.json'), 'utf8'));
      console.log('✓ DOM structure data loaded');
    }

    if (fs.existsSync(path.join(OUTPUT_DIR, 'api-endpoints.json'))) {
      files.apiEndpoints = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'api-endpoints.json'), 'utf8'));
      console.log('✓ API endpoints data loaded');
    }

    if (fs.existsSync(path.join(OUTPUT_DIR, 'forms-analysis.json'))) {
      files.formsAnalysis = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'forms-analysis.json'), 'utf8'));
      console.log('✓ Forms analysis data loaded');
    }

    if (fs.existsSync(path.join(OUTPUT_DIR, 'design-tokens.json'))) {
      files.designTokens = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'design-tokens.json'), 'utf8'));
      console.log('✓ Design tokens data loaded');
    }

    if (fs.existsSync(path.join(OUTPUT_DIR, 'visual-analysis.json'))) {
      files.visualAnalysis = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'visual-analysis.json'), 'utf8'));
      console.log('✓ Visual analysis data loaded');
    }
  } catch (error) {
    console.error('Error reading analysis files:', error.message);
  }

  return files;
}

function generateSpecification(analysisData) {
  console.log('\n📝 Generating comprehensive specification...');

  const {
    appExploration,
    featureAnalysis,
    apiEndpoints,
    formsAnalysis,
    designTokens
  } = analysisData;

  const modules = featureAnalysis?.modules || [];
  const features = featureAnalysis?.features || [];
  const tables = featureAnalysis?.tables || [];
  const forms = featureAnalysis?.forms || [];
  const dataModels = featureAnalysis?.dataModels || {};
  const userRoles = featureAnalysis?.userRoles || {};
  const apiEndpointsList = apiEndpoints?.endpoints || [];
  const formsList = formsAnalysis?.forms || [];
  const colors = designTokens?.designTokens?.colors || {};
  const fonts = designTokens?.designTokens?.typography?.fonts || [];

  const spec = `# Complete ERP System Specification
## Reverse Engineered from Operix.co

**Generated:** ${new Date().toISOString()}
**Analysis Method:** Automated Playwright MCP
**Scope:** Complete e-commerce ERP system

---

## Executive Summary

This specification documents the complete reverse-engineered structure of operix.co and provides requirements for building a fully-featured e-commerce ERP system alternative.

### Key Statistics
- **Modules:** ${modules.length}
- **Features:** ${features.length}
- **Data Tables:** ${tables.length}
- **Forms:** ${forms.length}
- **API Endpoints:** ${apiEndpointsList.length}
- **Data Models:** ${Object.keys(dataModels).length}
- **User Roles:** ${userRoles.roles?.length || 0}

---

## 1. System Architecture

### 1.1 Technology Stack
\`\`\`
Frontend:
- Next.js 14+ (TypeScript)
- React 18
- Tailwind CSS
- shadcn/ui components

Backend:
- Supabase (PostgreSQL)
- Row-Level Security (RLS)
- Realtime subscriptions

Integrations:
${appExploration?.features?.find(f => f.category === 'Integrations')?.items?.slice(0, 10).map(i => `- ${i}`).join('\n') || '- Payment gateways\n- E-commerce platforms\n- Shipping APIs'}
\`\`\`

### 1.2 System Components
\`\`\`
┌─────────────────────────────────────┐
│    Frontend (Next.js)               │
│  - Dashboard                        │
│  - Admin Panels                     │
│  - User Interfaces                  │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│    API Layer (Next.js API Routes)   │
│  - REST endpoints                   │
│  - Authentication                   │
│  - Business logic                   │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│    Database (Supabase/PostgreSQL)   │
│  - Core tables                      │
│  - Relationships                    │
│  - RLS policies                     │
└─────────────────────────────────────┘
\`\`\`

---

## 2. Module Structure

${modules.length > 0 ? `### Detected Modules (${modules.length})

\`\`\`
${modules.map(m => `• ${m.name || 'Unnamed'}`).slice(0, 20).join('\n')}
\`\`\`

#### Module Descriptions
${modules.slice(0, 10).map(m => `
**${m.name}**
- URL: ${m.href}
- Pattern: ${m.pattern}
- Type: Primary module
`).join('\n')}
` : '### Modules\nUnable to detect from landing page - requires app exploration'}

---

## 3. Data Models & Schema

### 3.1 Inferred Data Models
\`\`\`
${Object.entries(dataModels).map(([model, fields]) => {
  return `${model}
${fields.map(f => `  ├─ ${f}`).join('\n')}
${fields.length < 5 ? '  └─ (additional fields to be determined)' : ''}`;
}).join('\n\n')}
\`\`\`

### 3.2 Core Tables (Inferred)
\`\`\`
${tables.map(t => {
  return `Table ${t.index}:
  Columns: ${t.headers.join(', ')}
  Rows: ${t.rowCount}`;
}).slice(0, 10).join('\n\n')}
\`\`\`

---

## 4. User Roles & Permissions

### 4.1 Detected User Roles
\`\`\`
${userRoles.roles?.map(r => `• ${r.charAt(0).toUpperCase() + r.slice(1)}`).join('\n')}
\`\`\`

### 4.2 Role Permissions (To Be Defined)

| Role | Dashboard | Products | Orders | Customers | Analytics | Settings |
|------|-----------|----------|--------|-----------|-----------|----------|
| Admin | Full | Full | Full | Full | Full | Full |
| Manager | Full | Create/Edit | Full | View/Edit | Full | Limited |
| Staff | Limited | View | View/Update | View/Edit | View | No |
| Viewer | View Only | View | View | View | View | No |

---

## 5. Feature List

### 5.1 Identified Features (${features.length})
\`\`\`
${features.map(f => `• ${f.label}`).slice(0, 30).join('\n')}
\`\`\`

### 5.2 Feature Categories

#### Dashboard Features
- Real-time metrics
- Key performance indicators (KPIs)
- Chart visualizations
${designTokens?.designTokens?.colors && Object.keys(designTokens.designTokens.colors).length > 0 ? `- Chart libraries: ${featureAnalysis?.charts?.chartLibraries?.join(', ') || 'Recharts/Chart.js'}` : ''}

#### Product Management
- Add/Edit/Delete products
- SKU management
- Inventory tracking
- Product variants
- Bulk operations
- Import/Export

#### Order Management
- Create orders
- Order status tracking
- Fulfillment
- Shipping integration
- Returns management
- Order history

#### Customer Management
- Customer profiles
- Contact management
- Purchase history
- Customer segmentation
- Communication log

#### Reporting & Analytics
- Sales reports
- Product performance
- Customer analytics
- Inventory reports
- Financial reports

---

## 6. Forms & Data Entry

### 6.1 Forms Detected (${forms.length})
${forms.slice(0, 10).map((f, i) => {
  return `#### Form ${i + 1}: ${f.id}
- Action: ${f.action || 'N/A'}
- Method: ${f.method || 'POST'}
- Fields: ${f.fields.length}
- Fields:
${f.fields.map(field => `  - ${field.label || field.name} (${field.type}${field.required ? ', required' : ''})`).join('\n')}`;
}).join('\n\n')}

---

## 7. API Endpoints

### 7.1 Discovered Endpoints (${apiEndpointsList.length})
\`\`\`
${apiEndpointsList.slice(0, 20).map(e =>
  e.method.padEnd(6) + ' ' + e.url.substring(0, 60)
).join('\n')}
\`\`\`

### 7.2 Expected API Routes

\`\`\`
Authentication
  POST   /api/auth/login
  POST   /api/auth/register
  POST   /api/auth/logout
  POST   /api/auth/refresh

Products
  GET    /api/products
  GET    /api/products/:id
  POST   /api/products
  PUT    /api/products/:id
  DELETE /api/products/:id
  POST   /api/products/bulk

Orders
  GET    /api/orders
  GET    /api/orders/:id
  POST   /api/orders
  PUT    /api/orders/:id
  PATCH  /api/orders/:id/status

Customers
  GET    /api/customers
  GET    /api/customers/:id
  POST   /api/customers
  PUT    /api/customers/:id
  GET    /api/customers/:id/orders

Analytics
  GET    /api/analytics/dashboard
  GET    /api/analytics/sales
  GET    /api/analytics/products
  GET    /api/analytics/customers
\`\`\`

---

## 8. Design System

### 8.1 Color Palette (${Object.keys(colors).length} colors)
\`\`\`
${Object.entries(colors).slice(0, 15).map(([name, color]) =>
  color.padEnd(20) + ' // ' + name
).join('\n')}
\`\`\`

### 8.2 Typography
\`\`\`
Font Families:
${fonts.slice(0, 5).map(f => `• ${f}`).join('\n')}
\`\`\`

### 8.3 Component Library
\`\`\`
• Button (primary, secondary, danger)
• Card (simple, interactive)
• Table (with sorting, filtering, pagination)
• Form (with validation)
• Modal / Dialog
• Sidebar Navigation
• Top Navigation
• Badge / Tag
• Alert / Notification
• Dropdown / Select
• Input / Textarea
• Checkbox / Radio
\`\`\`

---

## 9. Database Schema (Preliminary)

### 9.1 Users Table
\`\`\`sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  company_id UUID REFERENCES companies(id),
  role VARCHAR(50) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

### 9.2 Products Table
\`\`\`sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id) NOT NULL,
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID,
  price DECIMAL(10, 2) NOT NULL,
  cost DECIMAL(10, 2),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

### 9.3 Orders Table
\`\`\`sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  order_number VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  total DECIMAL(10, 2) NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

### 9.4 Customers Table
\`\`\`sql
CREATE TABLE customers (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  city VARCHAR(100),
  country VARCHAR(100),
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

---

## 10. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Project setup
- [ ] Database schema design
- [ ] Authentication system
- [ ] Admin dashboard layout
- [ ] User management

### Phase 2: Core Features (Week 3-4)
- [ ] Product management
- [ ] Order management
- [ ] Customer management
- [ ] Basic analytics

### Phase 3: Advanced Features (Week 5-6)
- [ ] Advanced reporting
- [ ] Bulk operations
- [ ] Import/Export
- [ ] Integrations

### Phase 4: Polish & Deploy (Week 7-8)
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Testing
- [ ] Documentation
- [ ] Production deployment

---

## 11. Success Criteria

- [ ] All modules implemented
- [ ] All forms working with validation
- [ ] Database schema complete
- [ ] API endpoints functional
- [ ] Analytics working
- [ ] User authentication & roles implemented
- [ ] Design matches target (90%+ visual similarity)
- [ ] Performance optimized (Lighthouse 90+)
- [ ] Security audit passed
- [ ] Ready for production

---

## 12. Next Steps

1. **Review this specification** with your team
2. **Refine data models** based on deeper analysis
3. **Define API contracts** for each endpoint
4. **Provide to AI model** with unlimited tokens
5. **AI builds** the complete system
6. **You test** and iterate
7. **Deploy** to production

---

## Appendix

### A. Analysis Files Generated
- app-exploration.json - Application structure
- feature-analysis.json - Features and modules
- api-endpoints.json - API discovery
- forms-analysis.json - Form structures
- design-tokens.json - Design system
- dom-structure.json - Page structure

### B. Resources
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript](https://www.typescriptlang.org/docs)

### C. Assumptions
- Operix.co uses PostgreSQL
- Frontend is built with modern framework
- Authentication is JWT-based
- API follows REST conventions
- Multi-tenant architecture (companies/users)

---

**Specification Version:** 1.0
**Status:** Draft (requires AI model refinement)
**Estimated Build Time:** 4-8 weeks with unlimited token AI
`;

  return spec;
}

function main() {
  console.log('🚀 Comprehensive ERP Specification Generator\n');

  // Read analysis files
  const analysisData = readAnalysisFiles();

  // Generate specification
  const specification = generateSpecification(analysisData);

  // Save specification
  const specPath = path.join(OUTPUT_DIR, 'COMPLETE_ERP_SPECIFICATION.md');
  fs.writeFileSync(specPath, specification);

  console.log(`\n✅ Specification generated!`);
  console.log(`📄 Saved to: ${specPath}`);
  console.log(`\n📊 Specification Statistics:`);
  console.log(`  - Size: ${(specification.length / 1024).toFixed(1)}KB`);
  console.log(`  - Lines: ${specification.split('\n').length}`);
  console.log(`  - Sections: 12+`);

  console.log(`\n📋 Next Steps:`);
  console.log(`  1. Review COMPLETE_ERP_SPECIFICATION.md`);
  console.log(`  2. Refine data models if needed`);
  console.log(`  3. Provide to AI model with unlimited tokens`);
  console.log(`  4. AI builds the complete ERP system`);
}

main();
