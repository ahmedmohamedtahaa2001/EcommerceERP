/**
 * Extract DOM Structure using Playwright MCP
 * Captures the complete DOM hierarchy and structure
 */

require('dotenv').config();

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.env.TARGET_URL || 'https://operix.co/new-landing';
const OUTPUT_DIR = './analysis';

async function extractDOM() {
  console.log('🔍 Starting DOM extraction...');
  console.log(`📍 Target: ${TARGET_URL}`);

  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
    slowMo: parseInt(process.env.SLOW_MO || 500)
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 }
    });

    // Add request/response logging
    const networkLogs = [];

    page.on('request', request => {
      networkLogs.push({
        type: 'request',
        method: request.method(),
        url: request.url(),
        headers: request.headers(),
        timestamp: new Date().toISOString()
      });
    });

    page.on('response', async response => {
      try {
        networkLogs.push({
          type: 'response',
          status: response.status(),
          url: response.url(),
          contentType: response.headers()['content-type'],
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        console.log('Could not log response');
      }
    });

    console.log('\n📥 Navigating to target URL...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    console.log('✓ Page loaded');

    // Extract DOM structure
    console.log('\n📊 Extracting DOM structure...');
    const domStructure = await page.evaluate(() => {
      const extractElement = (element, depth = 0, maxDepth = 10) => {
        if (depth > maxDepth) return null;

        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);

        return {
          tagName: element.tagName.toLowerCase(),
          id: element.id || null,
          className: element.className || null,
          attributes: Array.from(element.attributes).reduce((acc, attr) => {
            if (!['class', 'id'].includes(attr.name)) {
              acc[attr.name] = attr.value;
            }
            return acc;
          }, {}),
          textContent: element.textContent?.substring(0, 200) || null,
          children: Array.from(element.children).map(child => extractElement(child, depth + 1, maxDepth)),
          visibility: {
            display: styles.display,
            visibility: styles.visibility,
            opacity: styles.opacity,
            width: styles.width,
            height: styles.height
          },
          position: {
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        };
      };

      return {
        title: document.title,
        url: document.URL,
        lang: document.documentElement.lang,
        structure: extractElement(document.documentElement),
        metadata: {
          viewport: document.querySelector('meta[name="viewport"]')?.content,
          description: document.querySelector('meta[name="description"]')?.content,
          ogTitle: document.querySelector('meta[property="og:title"]')?.content,
          ogImage: document.querySelector('meta[property="og:image"]')?.content,
          ogUrl: document.querySelector('meta[property="og:url"]')?.content,
          twitterCard: document.querySelector('meta[name="twitter:card"]')?.content
        },
        scripts: Array.from(document.scripts).map(s => ({
          src: s.src,
          isAsync: s.async,
          isDefer: s.defer,
          type: s.type,
          previewContent: s.src ? null : s.textContent?.substring(0, 100)
        })),
        stylesheets: Array.from(document.styleSheets).map(s => ({
          href: s.href,
          media: s.media.mediaText,
          disabled: s.disabled
        })),
        links: Array.from(document.querySelectorAll('link')).map(l => ({
          rel: l.rel,
          href: l.href,
          type: l.type,
          media: l.media
        }))
      };
    });

    console.log('✓ DOM structure extracted');

    // Extract all sections
    console.log('\n🔖 Identifying page sections...');
    const sections = await page.evaluate(() => {
      const sectionSelectors = [
        'section',
        '[class*="hero"]',
        '[class*="section"]',
        '[role="region"]',
        'main > *'
      ];

      const found = new Set();
      const sections = [];

      for (const selector of sectionSelectors) {
        document.querySelectorAll(selector).forEach((el, index) => {
          const key = `${el.tagName}-${el.className}`.substring(0, 50);
          if (!found.has(key) && el.offsetHeight > 100) {
            found.add(key);
            sections.push({
              selector: selector,
              tagName: el.tagName.toLowerCase(),
              classes: el.className,
              id: el.id,
              textPreview: el.textContent?.substring(0, 150),
              childrenCount: el.children.length,
              index: index
            });
          }
        });
      }

      return sections;
    });

    console.log(`✓ Found ${sections.length} sections`);

    // Extract component inventory
    console.log('\n🧩 Extracting components...');
    const components = await page.evaluate(() => {
      return {
        buttons: Array.from(document.querySelectorAll('button, a[class*="btn"], [class*="button"]'))
          .slice(0, 30)
          .map(el => ({
            text: el.textContent?.trim().substring(0, 100),
            tagName: el.tagName.toLowerCase(),
            classes: el.className,
            id: el.id,
            type: el.getAttribute('type'),
            href: el.getAttribute('href'),
            ariaLabel: el.getAttribute('aria-label')
          })),
        forms: Array.from(document.querySelectorAll('form')).map(form => ({
          id: form.id,
          name: form.name,
          action: form.action,
          method: form.method,
          fieldsCount: form.elements.length,
          fields: Array.from(form.elements)
            .filter(f => ['INPUT', 'TEXTAREA', 'SELECT'].includes(f.tagName))
            .map(f => ({
              type: f.type || f.tagName.toLowerCase(),
              name: f.name,
              id: f.id,
              placeholder: f.placeholder,
              required: f.required,
              classes: f.className
            }))
        })),
        images: Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.src,
          alt: img.alt,
          title: img.title,
          width: img.width,
          height: img.height,
          srcset: img.srcset,
          classes: img.className
        })),
        links: Array.from(document.querySelectorAll('a')).map(a => ({
          href: a.href,
          text: a.textContent?.trim().substring(0, 100),
          target: a.target,
          title: a.title,
          classes: a.className
        })),
        headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
          level: h.tagName.toLowerCase(),
          text: h.textContent?.trim(),
          id: h.id,
          classes: h.className
        }))
      };
    });

    console.log(`✓ Found components:`);
    console.log(`  - ${components.buttons.length} buttons`);
    console.log(`  - ${components.forms.length} forms`);
    console.log(`  - ${components.images.length} images`);
    console.log(`  - ${components.links.length} links`);
    console.log(`  - ${components.headings.length} headings`);

    // Save results
    console.log('\n💾 Saving results...');

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const results = {
      metadata: {
        timestamp: new Date().toISOString(),
        targetUrl: TARGET_URL,
        pageTitle: domStructure.title
      },
      domStructure: domStructure,
      sections: sections,
      components: components,
      networkRequests: networkLogs
    };

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'dom-structure.json'),
      JSON.stringify(results, null, 2)
    );

    console.log('✓ Saved to analysis/dom-structure.json');

    // Create summary report
    const summary = {
      timestamp: new Date().toISOString(),
      targetUrl: TARGET_URL,
      pageTitle: domStructure.title,
      statistics: {
        totalSections: sections.length,
        totalButtons: components.buttons.length,
        totalForms: components.forms.length,
        totalImages: components.images.length,
        totalLinks: components.links.length,
        totalHeadings: components.headings.length,
        networkRequests: networkLogs.length
      },
      sections: sections.map(s => s.classes || s.tagName),
      metadata: domStructure.metadata
    };

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'dom-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log('✓ Saved summary to analysis/dom-summary.json');

    console.log('\n✅ DOM extraction complete!');
    console.log('\nNext steps:');
    console.log('  1. Review analysis/dom-structure.json');
    console.log('  2. Run: npm run mcp:extract-apis');
    console.log('  3. Run: npm run mcp:visual-analysis');

  } catch (error) {
    console.error('❌ Error during extraction:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run extraction
extractDOM().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
