/**
 * Feature & Workflow Analysis
 * Maps all features, modules, and user workflows
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.env.APP_URL || 'https://operix.co';
const OUTPUT_DIR = './analysis';

async function analyzeFeatures() {
  console.log('🔍 Starting feature and workflow analysis...');
  console.log(`📍 Target: ${TARGET_URL}`);

  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false'
  });

  const analysis = {
    modules: [],
    features: [],
    workflows: [],
    dataModels: [],
    userRoles: [],
    actionButtons: [],
    tables: [],
    forms: [],
    charts: [],
    notifications: []
  };

  try {
    const page = await browser.newPage();

    console.log('\n📥 Loading application...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Detect modules/sections
    console.log('\n📦 Detecting modules...');
    const modules = await page.evaluate(() => {
      const detected = [];

      // Common ERP module names
      const modulePatterns = [
        'dashboard', 'products', 'inventory', 'orders', 'sales',
        'customers', 'suppliers', 'purchases', 'payments', 'reports',
        'analytics', 'users', 'settings', 'integration', 'warehouse',
        'shipping', 'accounts', 'invoices', 'expenses', 'employee',
        'hr', 'returns', 'reviews', 'marketing', 'support'
      ];

      // Check navigation elements
      const navElements = document.querySelectorAll('nav a, [class*="menu"] a, [class*="nav"] a, sidebar a');

      navElements.forEach(el => {
        const text = el.textContent?.toLowerCase() || '';
        const href = el.href || '';

        modulePatterns.forEach(pattern => {
          if (text.includes(pattern) || href.includes(pattern)) {
            detected.push({
              name: el.textContent?.trim(),
              href: href,
              icon: el.querySelector('svg, i, img')?.outerHTML,
              pattern: pattern
            });
          }
        });
      });

      return detected.filter((v, i, a) => a.findIndex(x => x.name === v.name) === i);
    });

    console.log(`✓ Found ${modules.length} modules`);
    modules.slice(0, 10).forEach(m => console.log(`  • ${m.name || 'Unnamed'}`));
    analysis.modules = modules;

    // Detect features in each section
    console.log('\n✨ Analyzing features...');
    const features = await page.evaluate(() => {
      const features = [];

      // Scan all buttons and actions
      document.querySelectorAll('button, a[class*="btn"], [class*="action"]').forEach((el, i) => {
        const text = el.textContent?.trim();
        const action = el.getAttribute('onclick') || el.className || '';

        if (text && text.length > 2 && text.length < 100) {
          features.push({
            type: 'action',
            label: text,
            element: el.tagName,
            class: el.className,
            action: action.substring(0, 100)
          });
        }
      });

      // Detect common actions
      const actionKeywords = ['Add', 'Create', 'Edit', 'Delete', 'Export', 'Import', 'Search', 'Filter', 'Sort', 'View', 'Print', 'Download', 'Share', 'Archive', 'Restore', 'Sync'];

      return features.filter(f =>
        actionKeywords.some(kw => f.label.includes(kw))
      ).slice(0, 30);
    });

    console.log(`✓ Found ${features.length} action features`);
    analysis.features = features;

    // Detect data tables
    console.log('\n📊 Analyzing data structures...');
    const tables = await page.evaluate(() => {
      const tableData = [];

      document.querySelectorAll('table, [role="table"], [class*="data"], [class*="grid"]').forEach((el, i) => {
        const headers = el.querySelectorAll('th, [role="columnheader"]');
        const headerNames = Array.from(headers).map(h => h.textContent?.trim());
        const rows = el.querySelectorAll('tr, [role="row"]');

        if (headerNames.length > 0) {
          tableData.push({
            index: i,
            headers: headerNames,
            rowCount: rows.length - 1,
            columns: headerNames.length,
            classes: el.className
          });
        }
      });

      return tableData;
    });

    console.log(`✓ Found ${tables.length} data tables`);
    console.log('Table structures:');
    tables.slice(0, 5).forEach(t => {
      console.log(`  Table ${t.index}: ${t.columns} columns, ${t.rowCount} rows`);
      console.log(`    Columns: ${t.headers.join(', ')}`);
    });
    analysis.tables = tables;

    // Detect forms
    console.log('\n📝 Analyzing forms...');
    const forms = await page.evaluate(() => {
      const formData = [];

      document.querySelectorAll('form, [class*="form"]').forEach((form, i) => {
        const fields = [];

        form.querySelectorAll('input, textarea, select').forEach(field => {
          fields.push({
            type: field.type || field.tagName.toLowerCase(),
            name: field.name,
            placeholder: field.placeholder,
            label: form.querySelector(`label[for="${field.id}"]`)?.textContent?.trim(),
            required: field.required
          });
        });

        const buttons = Array.from(form.querySelectorAll('button, input[type="submit"]')).map(b => ({
          text: b.textContent?.trim() || b.value,
          type: b.type
        }));

        if (fields.length > 0) {
          formData.push({
            id: form.id || `form-${i}`,
            action: form.action,
            method: form.method,
            fields: fields,
            buttons: buttons
          });
        }
      });

      return formData;
    });

    console.log(`✓ Found ${forms.length} forms`);
    forms.slice(0, 3).forEach(f => {
      console.log(`  Form: ${f.id} (${f.fields.length} fields)`);
      f.fields.forEach(field => console.log(`    - ${field.label || field.name}: ${field.type}`));
    });
    analysis.forms = forms;

    // Detect charts and visualizations
    console.log('\n📈 Analyzing visualizations...');
    const charts = await page.evaluate(() => {
      const chartLibraries = ['echarts', 'recharts', 'chart.js', 'plotly', 'highcharts'];
      const charts = [];

      // Look for chart elements
      document.querySelectorAll('canvas, svg[class*="chart"], div[class*="chart"]').forEach((el, i) => {
        charts.push({
          type: el.tagName,
          class: el.className,
          hasData: el.querySelectorAll('*').length > 0
        });
      });

      // Look for library usage
      const scripts = Array.from(document.scripts).map(s => s.src || s.textContent.substring(0, 100));
      const detectedLibs = chartLibraries.filter(lib =>
        scripts.some(s => s.includes(lib))
      );

      return {
        chartElements: charts,
        chartLibraries: detectedLibs
      };
    });

    console.log(`✓ Found ${charts.chartElements.length} chart elements`);
    if (charts.chartLibraries.length > 0) {
      console.log(`Chart libraries: ${charts.chartLibraries.join(', ')}`);
    }
    analysis.charts = charts;

    // Detect user roles and permissions
    console.log('\n👥 Detecting user roles...');
    const userRoles = await page.evaluate(() => {
      const roles = [];

      // Look for role indicators
      const rolePatterns = ['admin', 'manager', 'staff', 'user', 'viewer', 'editor', 'owner', 'seller', 'buyer'];
      const textContent = document.body.textContent.toLowerCase();

      rolePatterns.forEach(role => {
        if (textContent.includes(role)) {
          roles.push(role);
        }
      });

      // Look for permission-related text
      const permissionText = Array.from(document.querySelectorAll('*')).map(el =>
        el.textContent?.toLowerCase()
      ).join(' ');

      return {
        roles: roles,
        hasPermissions: permissionText.includes('permission'),
        hasRoles: permissionText.includes('role'),
        hasSettings: !!document.querySelector('[class*="settings"], [class*="admin"]')
      };
    });

    console.log('User roles detected:');
    userRoles.roles.forEach(r => console.log(`  • ${r}`));
    analysis.userRoles = userRoles;

    // Infer data models from page content
    console.log('\n🗄️ Inferring data models...');
    const dataModels = await page.evaluate(() => {
      const models = new Map();

      // Look for common ERP entities in text
      const entityPatterns = {
        'Product': ['sku', 'name', 'price', 'stock', 'description'],
        'Order': ['order', 'invoice', 'customer', 'total', 'status'],
        'Customer': ['email', 'phone', 'address', 'company'],
        'Supplier': ['supplier', 'vendor', 'contact'],
        'Invoice': ['invoice', 'amount', 'date', 'paid'],
        'Warehouse': ['warehouse', 'location', 'stock']
      };

      // Scan all text content
      const textContent = document.body.textContent.toLowerCase();

      Object.entries(entityPatterns).forEach(([entity, fields]) => {
        const matchedFields = fields.filter(field => textContent.includes(field));
        if (matchedFields.length > 0) {
          models.set(entity, matchedFields);
        }
      });

      return Object.fromEntries(models);
    });

    console.log('Data models inferred:');
    Object.entries(dataModels).forEach(([model, fields]) => {
      console.log(`  • ${model}: ${fields.join(', ')}`);
    });
    analysis.dataModels = dataModels;

    // Save analysis
    console.log('\n💾 Saving feature analysis...');

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'feature-analysis.json'),
      JSON.stringify(analysis, null, 2)
    );

    console.log('✓ Saved to analysis/feature-analysis.json');

    // Create detailed report
    const report = `# Feature & Workflow Analysis Report

Generated: ${new Date().toISOString()}

## Modules Detected (${modules.length})
\`\`\`
${modules.map(m => `• ${m.name}`).join('\n')}
\`\`\`

## Features/Actions Detected (${features.length})
\`\`\`
${features.map(f => `• ${f.label}`).join('\n')}
\`\`\`

## Data Tables Found (${tables.length})
\`\`\`
${tables.map(t => `• Table ${t.index}: ${t.headers.join(', ')}`).join('\n')}
\`\`\`

## Forms Detected (${forms.length})
\`\`\`
${forms.map(f => {
  const fieldNames = f.fields.map(fld => fld.label || fld.name).join(', ');
  return `• ${f.id}: ${fieldNames}`;
}).join('\n')}
\`\`\`

## Data Models Inferred
\`\`\`
${Object.entries(dataModels).map(([model, fields]) =>
  `${model}:\n  - ${fields.join('\n  - ')}`
).join('\n\n')}
\`\`\`

## User Roles
\`\`\`
${userRoles.roles.join('\n')}
\`\`\`

## Visualization Libraries
\`\`\`
${charts.chartLibraries.length > 0 ? charts.chartLibraries.join('\n') : 'None detected'}
\`\`\`

## Analysis Summary
- **Modules:** ${modules.length}
- **Features:** ${features.length}
- **Tables:** ${tables.length}
- **Forms:** ${forms.length}
- **Data Models:** ${Object.keys(dataModels).length}
- **Chart Elements:** ${charts.chartElements.length}

See \`feature-analysis.json\` for complete details.
`;

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'feature-analysis-report.md'),
      report
    );

    console.log('✓ Saved report to analysis/feature-analysis-report.md');

    console.log('\n✅ Feature analysis complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

analyzeFeatures().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
