/**
 * Visual Analysis using Playwright MCP
 * Captures screenshots at different breakpoints and extracts visual elements
 */

require('dotenv').config();

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.env.TARGET_URL || 'https://operix.co/new-landing';
const OUTPUT_DIR = './analysis';
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');

const viewports = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1920, height: 1080 }
];

async function visualAnalysis() {
  console.log('🔍 Starting visual analysis...');
  console.log(`📍 Target: ${TARGET_URL}`);

  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false'
  });

  try {
    const screenshotData = [];

    // Create screenshots directory
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }

    for (const viewport of viewports) {
      console.log(`\n📷 Capturing ${viewport.name} screenshots (${viewport.width}x${viewport.height})...`);

      const page = await browser.newPage({
        viewport: viewport
      });

      try {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

        // Capture full page
        const fullPagePath = path.join(SCREENSHOTS_DIR, `${viewport.name}-full-page.png`);
        await page.screenshot({
          path: fullPagePath,
          fullPage: true
        });
        console.log(`  ✓ Full page: ${viewport.name}-full-page.png`);

        // Capture above the fold
        const aboveTheFoldPath = path.join(SCREENSHOTS_DIR, `${viewport.name}-above-fold.png`);
        await page.screenshot({
          path: aboveTheFoldPath
        });
        console.log(`  ✓ Above fold: ${viewport.name}-above-fold.png`);

        // Extract visual information
        const visualInfo = await page.evaluate(() => {
          const sections = [];
          const colors = new Set();
          const fonts = new Set();

          document.querySelectorAll('section, [class*="section"], [class*="hero"], main > *').forEach((el, index) => {
            if (el.offsetHeight > 50) {
              const styles = window.getComputedStyle(el);
              const backgroundColor = styles.backgroundColor;
              const color = styles.color;

              sections.push({
                index: index,
                tagName: el.tagName.toLowerCase(),
                className: el.className,
                offsetTop: el.offsetTop,
                offsetHeight: el.offsetHeight,
                backgroundColor: backgroundColor,
                color: color,
                textContent: el.textContent?.substring(0, 100)
              });

              colors.add(backgroundColor);
              colors.add(color);
            }
          });

          // Get all computed colors
          document.querySelectorAll('*').forEach(el => {
            const styles = window.getComputedStyle(el);
            colors.add(styles.color);
            colors.add(styles.backgroundColor);
            colors.add(styles.borderColor);
            fonts.add(styles.fontFamily);
          });

          return {
            sections: sections,
            colors: Array.from(colors)
              .filter(c => c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent')
              .slice(0, 50),
            fonts: Array.from(fonts).filter(f => f).slice(0, 20),
            windowHeight: window.innerHeight,
            windowWidth: window.innerWidth,
            documentHeight: document.documentElement.scrollHeight
          };
        });

        screenshotData.push({
          viewport: viewport.name,
          timestamp: new Date().toISOString(),
          visualInfo: visualInfo,
          fullPagePath: fullPagePath,
          aboveFoldPath: aboveTheFoldPath
        });

        // Capture individual sections
        console.log(`  📍 Capturing sections...`);
        const sectionElements = await page.$$('section, [class*="hero"], [class*="feature"], [class*="cta"]');

        for (let i = 0; i < Math.min(sectionElements.length, 5); i++) {
          try {
            const sectionPath = path.join(SCREENSHOTS_DIR, `${viewport.name}-section-${i}.png`);
            await sectionElements[i].screenshot({ path: sectionPath });
            console.log(`    ✓ Section ${i} captured`);
          } catch (e) {
            console.log(`    ✗ Section ${i} failed: ${e.message}`);
          }
        }

      } catch (error) {
        console.error(`  ❌ Error with ${viewport.name}: ${error.message}`);
      } finally {
        await page.close();
      }
    }

    // Save analysis data
    console.log('\n💾 Saving results...');

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'visual-analysis.json'),
      JSON.stringify({
        metadata: {
          timestamp: new Date().toISOString(),
          targetUrl: TARGET_URL,
          viewportsAnalyzed: viewports.length
        },
        data: screenshotData
      }, null, 2)
    );

    console.log('✓ Saved visual analysis to analysis/visual-analysis.json');

    // Create a visual summary
    const visualSummary = {
      timestamp: new Date().toISOString(),
      targetUrl: TARGET_URL,
      screenshots: {
        mobile: {
          fullPage: 'mobile-full-page.png',
          aboveFold: 'mobile-above-fold.png'
        },
        tablet: {
          fullPage: 'tablet-full-page.png',
          aboveFold: 'tablet-above-fold.png'
        },
        desktop: {
          fullPage: 'desktop-full-page.png',
          aboveFold: 'desktop-above-fold.png'
        }
      },
      analysis: screenshotData.map(s => ({
        viewport: s.viewport,
        sections: s.visualInfo.sections.length,
        uniqueColors: s.visualInfo.colors.length,
        uniqueFonts: s.visualInfo.fonts.length,
        pageHeight: s.visualInfo.documentHeight,
        colors: s.visualInfo.colors.slice(0, 10),
        fonts: s.visualInfo.fonts
      }))
    };

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'visual-summary.json'),
      JSON.stringify(visualSummary, null, 2)
    );

    console.log('✓ Saved summary to analysis/visual-summary.json');

    // Create a README for screenshots
    fs.writeFileSync(
      path.join(SCREENSHOTS_DIR, 'README.md'),
      `# Visual Analysis Screenshots

Generated: ${new Date().toISOString()}
Target: ${TARGET_URL}

## Files

### Mobile (375x667)
- \`mobile-full-page.png\` - Full page screenshot
- \`mobile-above-fold.png\` - Viewport-visible area
- \`mobile-section-*.png\` - Individual section screenshots

### Tablet (768x1024)
- \`tablet-full-page.png\` - Full page screenshot
- \`tablet-above-fold.png\` - Viewport-visible area
- \`tablet-section-*.png\` - Individual section screenshots

### Desktop (1920x1080)
- \`desktop-full-page.png\` - Full page screenshot
- \`desktop-above-fold.png\` - Viewport-visible area
- \`desktop-section-*.png\` - Individual section screenshots

## Usage

Use these screenshots to:
1. Identify layout patterns across breakpoints
2. Check responsive behavior
3. Extract color schemes and typography
4. Understand content hierarchy
5. Design component specifications

See \`../visual-analysis.json\` for detailed visual data.
`
    );

    console.log('✓ Created screenshot README');

    console.log('\n✅ Visual analysis complete!');
    console.log(`\nScreenshots saved to: ${SCREENSHOTS_DIR}`);
    console.log('Captured viewports:');
    viewports.forEach(vp => {
      console.log(`  • ${vp.name}: ${vp.width}x${vp.height}`);
    });

    console.log('\nNext steps:');
    console.log('  1. Review screenshots in analysis/screenshots/');
    console.log('  2. Review analysis/visual-analysis.json');
    console.log('  3. Run: npm run mcp:extract-tokens');

  } catch (error) {
    console.error('❌ Error during visual analysis:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run analysis
visualAnalysis().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
