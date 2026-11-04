/**
 * Extract API Endpoints using Playwright MCP
 * Captures all network requests and identifies API endpoints
 */

require('dotenv').config();

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.env.TARGET_URL || 'https://operix.co/new-landing';
const OUTPUT_DIR = './analysis';

async function extractAPIs() {
  console.log('🔍 Starting API endpoint extraction...');
  console.log(`📍 Target: ${TARGET_URL}`);

  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
    slowMo: parseInt(process.env.SLOW_MO || 500)
  });

  try {
    const context = await browser.newContext({
      recordVideo: process.env.RECORD_VIDEO !== 'false' ? {
        dir: path.join(OUTPUT_DIR, 'videos')
      } : undefined
    });

    const page = await context.newPage();

    const apiEndpoints = [];
    const networkLogs = [];
    const failedRequests = [];

    // Track all requests
    page.on('request', request => {
      const url = request.url();
      const method = request.method();

      networkLogs.push({
        type: 'request',
        method: method,
        url: url,
        resourceType: request.resourceType(),
        headers: request.headers(),
        postData: request.postData(),
        timestamp: new Date().toISOString()
      });
    });

    // Track responses
    page.on('response', async response => {
      try {
        const url = response.url();
        const method = response.request().method();
        const status = response.status();
        const contentType = response.headers()['content-type'] || '';

        // Identify API endpoints
        if (
          url.includes('/api/') ||
          url.includes('graphql') ||
          url.includes('.json') ||
          contentType.includes('application/json')
        ) {
          let body = null;
          try {
            body = await response.text();
            if (body.length > 10000) {
              body = body.substring(0, 10000) + '... (truncated)';
            }
          } catch (e) {
            body = null;
          }

          apiEndpoints.push({
            method: method,
            url: url,
            status: status,
            contentType: contentType,
            body: body ? (body.substring(0, 500) + (body.length > 500 ? '...' : '')) : null,
            timestamp: new Date().toISOString()
          });

          if (status >= 400) {
            failedRequests.push({
              method: method,
              url: url,
              status: status,
              reason: status === 404 ? 'Not Found' : 'Error'
            });
          }
        }
      } catch (e) {
        console.log('Could not process response');
      }
    });

    console.log('\n📥 Navigating to target URL...');
    await page.goto(TARGET_URL, {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    console.log('✓ Page loaded');

    // Simulate user interactions to trigger more API calls
    console.log('\n🖱️  Simulating user interactions...');

    const interactionScripts = [
      // Try clicking buttons
      async () => {
        const buttons = await page.$$('button');
        for (const button of buttons.slice(0, 5)) {
          try {
            await button.click();
            await page.waitForTimeout(1000);
          } catch (e) {
            // Ignore errors
          }
        }
      },
      // Try scrolling
      async () => {
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForTimeout(1000);
      },
      // Try hovering over interactive elements
      async () => {
        const links = await page.$$('a[href*="#"]');
        for (const link of links.slice(0, 5)) {
          try {
            await link.hover();
            await page.waitForTimeout(500);
          } catch (e) {
            // Ignore errors
          }
        }
      }
    ];

    for (const script of interactionScripts) {
      try {
        await script();
      } catch (e) {
        console.log('Interaction skipped:', e.message);
      }
    }

    console.log('✓ Interactions completed');

    // Extract inline scripts that might contain API info
    console.log('\n📝 Extracting inline scripts...');
    const inlineScripts = await page.evaluate(() => {
      return Array.from(document.scripts)
        .filter(s => !s.src || s.textContent)
        .map(s => ({
          src: s.src,
          content: s.textContent?.substring(0, 1000),
          type: s.type,
          attributes: Array.from(s.attributes).reduce((acc, attr) => {
            acc[attr.name] = attr.value;
            return acc;
          }, {})
        }))
        .slice(0, 20);
    });

    // Extract environment variables or config from page
    console.log('\n⚙️  Extracting configuration...');
    const pageConfig = await page.evaluate(() => {
      const config = {};

      // Check common config locations
      if (window.__APP_CONFIG__) config.appConfig = window.__APP_CONFIG__;
      if (window.__ENV__) config.env = window.__ENV__;
      if (window.__API__) config.api = window.__API__;
      if (window.ENV) config.ENV = window.ENV;

      // Check for Sentry, Mixpanel, etc.
      if (window.Sentry) config.hasSentry = true;
      if (window.mixpanel) config.hasMixpanel = true;
      if (window.gtag) config.hasGoogleAnalytics = true;
      if (window.amplitude) config.hasAmplitude = true;

      return config;
    });

    console.log('✓ Configuration extracted');

    // Save results
    console.log('\n💾 Saving results...');

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Save API endpoints
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'api-endpoints.json'),
      JSON.stringify({
        metadata: {
          timestamp: new Date().toISOString(),
          targetUrl: TARGET_URL,
          totalEndpoints: apiEndpoints.length,
          failedRequests: failedRequests.length
        },
        endpoints: apiEndpoints,
        failedRequests: failedRequests,
        pageConfig: pageConfig,
        inlineScripts: inlineScripts.slice(0, 5)
      }, null, 2)
    );

    console.log(`✓ Saved ${apiEndpoints.length} endpoints to analysis/api-endpoints.json`);

    // Save network log
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'network-log.json'),
      JSON.stringify({
        metadata: {
          timestamp: new Date().toISOString(),
          targetUrl: TARGET_URL,
          totalRequests: networkLogs.length
        },
        requests: networkLogs.slice(0, 100)
      }, null, 2)
    );

    console.log(`✓ Saved network log to analysis/network-log.json`);

    // Create summary
    const summary = {
      timestamp: new Date().toISOString(),
      targetUrl: TARGET_URL,
      statistics: {
        totalNetworkRequests: networkLogs.length,
        apiEndpoints: apiEndpoints.length,
        failedRequests: failedRequests.length,
        inlineScripts: inlineScripts.length
      },
      apiSummary: apiEndpoints.map(e => ({
        method: e.method,
        url: e.url.substring(0, 200),
        status: e.status,
        contentType: e.contentType
      })),
      configuration: pageConfig
    };

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'api-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log('✓ Saved summary to analysis/api-summary.json');

    console.log('\n✅ API extraction complete!');
    console.log(`\nFound ${apiEndpoints.length} API endpoints`);
    if (apiEndpoints.length > 0) {
      console.log('\nTop endpoints:');
      apiEndpoints.slice(0, 5).forEach(ep => {
        console.log(`  ${ep.method.padEnd(6)} ${ep.url.substring(0, 80)}`);
      });
    }

    console.log('\nNext steps:');
    console.log('  1. Review analysis/api-endpoints.json');
    console.log('  2. Run: npm run mcp:analyze-forms');
    console.log('  3. Run: npm run mcp:visual-analysis');

    await context.close();
  } catch (error) {
    console.error('❌ Error during extraction:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run extraction
extractAPIs().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
