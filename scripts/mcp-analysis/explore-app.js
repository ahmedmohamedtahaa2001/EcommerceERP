/**
 * Automated Application Explorer using Playwright
 * Explores operix.co to find features, APIs, and app structure
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.env.APP_URL || 'https://operix.co';
const OUTPUT_DIR = './analysis';

async function exploreApp() {
  console.log('🔍 Starting operix.co application exploration...');
  console.log(`📍 Target: ${TARGET_URL}`);

  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false'
  });

  const exploration = {
    pages: [],
    features: [],
    workflows: [],
    apiEndpoints: [],
    modules: [],
    forms: [],
    errors: []
  };

  try {
    const context = await browser.newContext({
      recordVideo: { dir: path.join(OUTPUT_DIR, 'videos') }
    });

    const page = await context.newPage();

    // Intercept all network requests
    const networkData = [];
    page.on('response', async response => {
      try {
        const url = response.url();
        if (url.includes('/api/') || url.includes('graphql')) {
          networkData.push({
            method: response.request().method(),
            url: url,
            status: response.status(),
            type: response.request().resourceType()
          });
        }
      } catch (e) {}
    });

    console.log('\n📥 Navigating to operix.co...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✓ Page loaded');

    // Screenshot homepage
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'screenshots/operix-homepage.png'),
      fullPage: true
    });

    // Look for sign-up / login links
    console.log('\n🔐 Looking for authentication options...');
    const authElements = await page.evaluate(() => {
      return {
        loginLinks: Array.from(document.querySelectorAll('a')).filter(a =>
          a.href.includes('login') || a.href.includes('signin') || a.textContent.toLowerCase().includes('login')
        ).map(a => ({ text: a.textContent, href: a.href })),

        signupLinks: Array.from(document.querySelectorAll('a')).filter(a =>
          a.href.includes('signup') || a.href.includes('register') || a.textContent.toLowerCase().includes('sign up')
        ).map(a => ({ text: a.textContent, href: a.href })),

        demoLinks: Array.from(document.querySelectorAll('a')).filter(a =>
          a.href.includes('demo') || a.textContent.toLowerCase().includes('demo')
        ).map(a => ({ text: a.textContent, href: a.href })),

        ctaButtons: Array.from(document.querySelectorAll('button, a[class*="btn"], a[class*="cta"]')).map(b => ({
          text: b.textContent?.trim(),
          href: b.getAttribute('href'),
          onClick: b.getAttribute('onclick')
        })).slice(0, 10)
      };
    });

    console.log('Found auth options:');
    if (authElements.loginLinks.length) console.log(`  • ${authElements.loginLinks.length} login link(s)`);
    if (authElements.signupLinks.length) console.log(`  • ${authElements.signupLinks.length} signup link(s)`);
    if (authElements.demoLinks.length) console.log(`  • ${authElements.demoLinks.length} demo link(s)`);

    exploration.features.push({
      category: 'Authentication',
      items: authElements
    });

    // Try to access demo or trial
    console.log('\n🎯 Attempting to access application demo/trial...');

    let appUrl = null;

    // Try demo link first
    if (authElements.demoLinks.length > 0) {
      appUrl = authElements.demoLinks[0].href;
      console.log(`Trying demo: ${appUrl}`);
    } else if (authElements.signupLinks.length > 0) {
      appUrl = authElements.signupLinks[0].href;
      console.log(`Trying signup: ${appUrl}`);
    }

    if (appUrl) {
      try {
        await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);

        const pageTitle = await page.title();
        const pageUrl = page.url();

        console.log(`✓ Accessed: ${pageUrl}`);
        console.log(`  Title: ${pageTitle}`);

        // Screenshot the page
        await page.screenshot({
          path: path.join(OUTPUT_DIR, `screenshots/operix-${Date.now()}.png`),
          fullPage: true
        });

        // Check for common app patterns
        const appStructure = await page.evaluate(() => {
          return {
            hasNavigation: !!document.querySelector('nav'),
            hasSidebar: !!document.querySelector('[class*="sidebar"], [class*="nav"], aside'),
            hasDashboard: !!document.querySelector('[class*="dashboard"], [class*="main"]'),
            hasTable: !!document.querySelector('table'),
            hasForm: !!document.querySelector('form'),
            hasDataGrid: !!document.querySelector('[class*="grid"], [class*="table"], [class*="data"]'),
            modules: Array.from(document.querySelectorAll('[class*="nav"], li, a')).map(el =>
              el.textContent?.trim()
            ).filter(text => text && text.length > 2 && text.length < 50).slice(0, 20)
          };
        });

        console.log('\n📊 App Structure Detected:');
        if (appStructure.hasNavigation) console.log('  ✓ Navigation menu found');
        if (appStructure.hasSidebar) console.log('  ✓ Sidebar menu found');
        if (appStructure.hasDashboard) console.log('  ✓ Dashboard layout found');
        if (appStructure.hasTable) console.log('  ✓ Data tables found');
        if (appStructure.hasForm) console.log('  ✓ Forms found');
        if (appStructure.hasDataGrid) console.log('  ✓ Data grid found');

        exploration.modules = appStructure.modules;

      } catch (e) {
        console.log(`✗ Could not access: ${e.message}`);
        exploration.errors.push(`App access failed: ${e.message}`);
      }
    }

    // Analyze landing page features
    console.log('\n🏢 Analyzing features from landing page...');
    const pageFeatures = await page.goto(TARGET_URL, { waitUntil: 'networkidle' }).then(() =>
      page.evaluate(() => {
        const features = [];

        // Look for feature sections
        document.querySelectorAll('[class*="feature"], [class*="benefit"], .card, [class*="module"]').forEach((el, i) => {
          const text = el.textContent?.substring(0, 200);
          const heading = el.querySelector('h2, h3, h4, .title');
          if (heading && text && text.length > 10) {
            features.push({
              index: i,
              heading: heading.textContent?.trim(),
              description: text,
              classes: el.className
            });
          }
        });

        return features.slice(0, 20);
      })
    );

    console.log(`Found ${pageFeatures.length} feature descriptions`);
    exploration.features.push({
      category: 'Landing Page Features',
      items: pageFeatures
    });

    // Look for pricing/plans
    console.log('\n💰 Looking for pricing information...');
    const pricing = await page.evaluate(() => {
      const pricingElements = document.querySelectorAll('[class*="price"], [class*="plan"], [class*="tier"]');
      return Array.from(pricingElements).map(el => ({
        text: el.textContent?.substring(0, 300),
        classes: el.className
      })).slice(0, 10);
    });

    if (pricing.length > 0) {
      console.log(`✓ Found ${pricing.length} pricing elements`);
      exploration.features.push({
        category: 'Pricing',
        items: pricing
      });
    }

    // Extract all links for site mapping
    console.log('\n🗺️ Mapping site structure...');
    const siteMap = await page.evaluate(() => {
      return {
        internalLinks: Array.from(document.querySelectorAll('a')).filter(a =>
          a.href && a.href.includes(window.location.hostname)
        ).map(a => ({
          text: a.textContent?.trim(),
          href: a.href,
          path: new URL(a.href).pathname
        })).filter((a, i, arr) => i === arr.findIndex(x => x.href === a.href)).slice(0, 50),

        externalLinks: Array.from(document.querySelectorAll('a')).filter(a =>
          a.href && !a.href.includes(window.location.hostname) && a.href.startsWith('http')
        ).map(a => ({
          text: a.textContent?.trim(),
          href: a.href,
          domain: new URL(a.href).hostname
        })).slice(0, 30)
      };
    });

    console.log(`✓ Found ${siteMap.internalLinks.length} internal links`);
    console.log(`✓ Found ${siteMap.externalLinks.length} external integrations`);

    // Identify integrations
    const integrations = siteMap.externalLinks.map(l => l.domain).filter((v, i, a) => a.indexOf(v) === i);
    console.log('\nIntegrations detected:');
    integrations.slice(0, 10).forEach(int => console.log(`  • ${int}`));

    exploration.features.push({
      category: 'Integrations',
      items: integrations
    });

    // Check for API documentation
    console.log('\n📚 Looking for API documentation...');
    const apiDocs = siteMap.internalLinks.filter(l =>
      l.path.includes('api') || l.path.includes('doc') || l.text?.toLowerCase().includes('api')
    );

    if (apiDocs.length > 0) {
      console.log(`Found ${apiDocs.length} API-related links`);
      exploration.features.push({
        category: 'API Documentation',
        items: apiDocs
      });
    }

    // Extract company info
    console.log('\n🏢 Extracting company information...');
    const companyInfo = await page.evaluate(() => {
      return {
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content,
        keywords: document.querySelector('meta[name="keywords"]')?.content,
        email: Array.from(document.querySelectorAll('a')).find(a => a.href.startsWith('mailto:'))?.href.replace('mailto:', ''),
        phone: Array.from(document.querySelectorAll('a')).find(a => a.href.startsWith('tel:'))?.href.replace('tel:', ''),
        address: Array.from(document.querySelectorAll('*')).find(a =>
          a.textContent?.includes('Street') || a.textContent?.includes('City')
        )?.textContent?.substring(0, 200)
      };
    });

    console.log('Company info:');
    if (companyInfo.email) console.log(`  Email: ${companyInfo.email}`);
    if (companyInfo.phone) console.log(`  Phone: ${companyInfo.phone}`);
    if (companyInfo.keywords) console.log(`  Keywords: ${companyInfo.keywords.substring(0, 100)}`);

    exploration.features.push({
      category: 'Company Info',
      items: companyInfo
    });

    // Save results
    console.log('\n💾 Saving exploration results...');

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const results = {
      metadata: {
        timestamp: new Date().toISOString(),
        targetUrl: TARGET_URL,
        explorationTime: 'automated-playwright'
      },
      exploration: exploration,
      networkData: networkData.slice(0, 50),
      siteMap: siteMap
    };

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'app-exploration.json'),
      JSON.stringify(results, null, 2)
    );

    console.log('✓ Saved to analysis/app-exploration.json');

    // Create summary report
    const report = `# Operix.co Application Exploration Report

Generated: ${new Date().toISOString()}

## Summary
- **URL:** ${TARGET_URL}
- **Exploration Method:** Automated Playwright
- **Pages Analyzed:** ${1 + (appUrl ? 1 : 0)}
- **API Endpoints Found:** ${networkData.length}
- **Features Identified:** ${pageFeatures.length}
- **Integrations Detected:** ${integrations.length}

## Key Findings

### Modules/Features
\`\`\`
${exploration.modules.join('\n')}
\`\`\`

### Integrations
\`\`\`
${integrations.join('\n')}
\`\`\`

### Internal Pages
\`\`\`
${siteMap.internalLinks.map(l => `${l.path} - ${l.text}`).join('\n')}
\`\`\`

### API Endpoints Found
\`\`\`
${networkData.map(r => `${r.method.padEnd(6)} ${r.url.substring(0, 80)}`).join('\n')}
\`\`\`

### Company Information
- **Title:** ${companyInfo.title}
- **Email:** ${companyInfo.email || 'Not found'}
- **Phone:** ${companyInfo.phone || 'Not found'}

## Screenshots Generated
- operix-homepage.png - Landing page
- operix-*.png - Application screenshots

## Next Steps
1. Review API endpoints in network tab
2. Analyze feature hierarchy
3. Map data structures from API responses
4. Document required fields and relationships
5. Plan database schema

See \`analysis/app-exploration.json\` for complete data.
`;

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'app-exploration-report.md'),
      report
    );

    console.log('✓ Saved report to analysis/app-exploration-report.md');

    console.log('\n✅ Application exploration complete!');
    console.log('\nFiles generated:');
    console.log('  • analysis/app-exploration.json');
    console.log('  • analysis/app-exploration-report.md');
    console.log('  • analysis/screenshots/operix-*.png');
    console.log('  • analysis/videos/ (if enabled)');

    await context.close();

  } catch (error) {
    console.error('❌ Error during exploration:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run exploration
exploreApp().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
