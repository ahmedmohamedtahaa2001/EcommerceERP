/**
 * Extract Design Tokens using Playwright MCP
 * Extracts colors, typography, spacing, and other design system tokens
 */

require('dotenv').config();

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.env.TARGET_URL || 'https://operix.co/new-landing';
const OUTPUT_DIR = './analysis';

function parseColor(colorString) {
  // Normalize color string
  if (!colorString || colorString === 'transparent' || colorString === 'rgba(0, 0, 0, 0)') {
    return null;
  }
  return colorString;
}

function parseFontSize(fontSizeString) {
  if (!fontSizeString) return null;
  const match = fontSizeString.match(/(\d+)(?:\.?\d+)?(px|rem|em|%)/);
  if (match) {
    return {
      value: parseFloat(match[1]),
      unit: match[2]
    };
  }
  return null;
}

function parseSpacing(spacingString) {
  if (!spacingString) return null;
  const match = spacingString.match(/(\d+)(?:\.?\d+)?(px|rem|em|%)/);
  if (match) {
    return {
      value: parseFloat(match[1]),
      unit: match[2]
    };
  }
  return null;
}

async function extractDesignTokens() {
  console.log('🔍 Starting design token extraction...');
  console.log(`📍 Target: ${TARGET_URL}`);

  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
    slowMo: parseInt(process.env.SLOW_MO || 500)
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 }
    });

    console.log('\n📥 Navigating to target URL...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    console.log('✓ Page loaded');

    // Extract design tokens
    console.log('\n🎨 Extracting design tokens...');

    const designTokens = await page.evaluate(() => {
      const tokens = {
        colors: {},
        typography: {
          fonts: [],
          sizes: [],
          weights: [],
          lineHeights: [],
          letterSpacings: []
        },
        spacing: {
          margins: [],
          paddings: [],
          gaps: []
        },
        borderRadius: [],
        shadows: [],
        borders: [],
        breakpoints: [],
        zIndex: []
      };

      // Helper to normalize values
      const normalizedValues = {
        colors: new Map(),
        fonts: new Set(),
        sizes: new Set(),
        weights: new Set(),
        spacing: new Set(),
        borderRadius: new Set(),
        shadows: new Set(),
        borders: new Set()
      };

      // Scan all elements
      document.querySelectorAll('*').forEach(el => {
        const styles = window.getComputedStyle(el);

        // Colors
        ['color', 'backgroundColor', 'borderColor'].forEach(prop => {
          const value = styles[prop];
          if (value && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') {
            normalizedValues.colors.set(value, (normalizedValues.colors.get(value) || 0) + 1);
          }
        });

        // Typography
        if (styles.fontFamily) normalizedValues.fonts.add(styles.fontFamily);
        if (styles.fontSize) normalizedValues.sizes.add(styles.fontSize);
        if (styles.fontWeight) normalizedValues.weights.add(styles.fontWeight);
        if (styles.lineHeight) tokens.typography.lineHeights.push(styles.lineHeight);
        if (styles.letterSpacing) tokens.typography.letterSpacings.push(styles.letterSpacing);

        // Spacing
        if (styles.margin) normalizedValues.spacing.add(styles.margin);
        if (styles.padding) normalizedValues.spacing.add(styles.padding);
        if (styles.gap) normalizedValues.spacing.add(styles.gap);

        // Border radius
        if (styles.borderRadius) normalizedValues.borderRadius.add(styles.borderRadius);

        // Shadows
        if (styles.boxShadow && styles.boxShadow !== 'none') {
          normalizedValues.shadows.add(styles.boxShadow);
        }

        // Borders
        if (styles.border && styles.border !== 'none') {
          normalizedValues.borders.add(styles.border);
        }

        // Z-index
        const zIndex = styles.zIndex;
        if (zIndex && zIndex !== 'auto') {
          tokens.zIndex.push(parseInt(zIndex));
        }
      });

      // Check for CSS variables
      const cssVariables = {};
      const root = document.documentElement;
      const styles = getComputedStyle(root);

      for (let i = 0; i < styles.length; i++) {
        const prop = styles[i];
        if (prop.startsWith('--')) {
          cssVariables[prop] = styles.getPropertyValue(prop).trim();
        }
      }

      // Populate tokens with normalized values
      tokens.colors = Object.fromEntries(
        Array.from(normalizedValues.colors.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50)
          .map(([color]) => [color, color])
      );

      tokens.typography.fonts = Array.from(normalizedValues.fonts).slice(0, 20);
      tokens.typography.sizes = Array.from(normalizedValues.sizes).slice(0, 20);
      tokens.typography.weights = Array.from(normalizedValues.weights).sort();
      tokens.spacing.values = Array.from(normalizedValues.spacing).slice(0, 30);
      tokens.borderRadius = Array.from(normalizedValues.borderRadius).slice(0, 20);
      tokens.shadows = Array.from(normalizedValues.shadows).slice(0, 10);
      tokens.borders = Array.from(normalizedValues.borders).slice(0, 10);
      tokens.zIndex = Array.from(new Set(tokens.zIndex)).sort((a, b) => a - b);

      return {
        cssVariables: cssVariables,
        ...tokens
      };
    });

    console.log('✓ Design tokens extracted');

    // Extract Tailwind classes if present
    console.log('\n🔍 Analyzing Tailwind classes...');
    const tailwindAnalysis = await page.evaluate(() => {
      const classes = new Map();
      const tailwindPattern = /^(bg|text|border|w|h|m|p|gap|rounded|shadow|flex|grid|absolute|fixed|top|left|right|bottom|z|opacity|transform|transition|hover|focus|active|dark|sm|md|lg|xl|2xl|max|min|space|divide|inset|ring|outline|caret|accent|decoration|underline|line|indent|tracking|leading|truncate|whitespace|break|align|justify|items|content|self|start|end|between|around|evenly|grow|shrink|basis|order|col|row|auto|cols|rows|span|start|end|full|screen|visible|invisible|block|inline|table|list|run|flow|hidden|clip|visible|collapse|resize|touch|select|cursor|pointer-events|appearance|will-change|print|sr-only)(-|_)/;

      document.querySelectorAll('[class]').forEach(el => {
        const classList = el.className.split(/\s+/);
        classList.forEach(cls => {
          if (tailwindPattern.test(cls)) {
            classes.set(cls, (classes.get(cls) || 0) + 1);
          }
        });
      });

      return {
        totalClasses: classes.size,
        topClasses: Array.from(classes.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50)
          .map(([cls]) => cls)
      };
    });

    console.log(`✓ Found ${tailwindAnalysis.totalClasses} unique Tailwind classes`);

    // Extract responsive design information
    console.log('\n📱 Analyzing responsive design...');
    const responsiveInfo = await page.evaluate(() => {
      // Check for media queries in stylesheets
      const mediaQueries = [];

      try {
        for (let i = 0; i < document.styleSheets.length; i++) {
          const sheet = document.styleSheets[i];
          try {
            const rules = sheet.cssRules || sheet.rules;
            for (let j = 0; j < rules.length; j++) {
              const rule = rules[j];
              if (rule.type === 4) { // MEDIA_RULE
                mediaQueries.push(rule.media.mediaText);
              }
            }
          } catch (e) {
            // CORS or other issues accessing stylesheet
          }
        }
      } catch (e) {
        // Ignore
      }

      return {
        mediaQueries: Array.from(new Set(mediaQueries)),
        viewportMeta: document.querySelector('meta[name="viewport"]')?.content
      };
    });

    console.log(`✓ Found ${responsiveInfo.mediaQueries.length} media queries`);

    // Save results
    console.log('\n💾 Saving results...');

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const completeTokens = {
      metadata: {
        timestamp: new Date().toISOString(),
        targetUrl: TARGET_URL
      },
      designTokens: designTokens,
      tailwind: tailwindAnalysis,
      responsive: responsiveInfo
    };

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'design-tokens.json'),
      JSON.stringify(completeTokens, null, 2)
    );

    console.log('✓ Saved design tokens to analysis/design-tokens.json');

    // Create a Tailwind config template based on extracted tokens
    const tailwindConfig = `// Tailwind CSS Configuration
// Generated from design token extraction

module.exports = {
  theme: {
    extend: {
      colors: {
        // Add extracted colors here
        // ${Object.keys(designTokens.colors).slice(0, 3).join(', ')}
      },
      fontFamily: {
        // Add extracted fonts here
        // ${designTokens.typography.fonts.slice(0, 2).join(', ')}
      },
      fontSize: {
        // Add extracted font sizes here
      },
      spacing: {
        // Add extracted spacing here
      },
      borderRadius: {
        // Add extracted border radius here
      },
      boxShadow: {
        // Add extracted shadows here
      },
      breakpoints: {
        // Custom breakpoints
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px'
      }
    }
  },
  plugins: []
};
`;

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'tailwind.config.template.js'),
      tailwindConfig
    );

    console.log('✓ Created Tailwind config template');

    // Create a design tokens documentation
    const tokenDocs = `# Design Tokens

Extracted from: ${TARGET_URL}
Timestamp: ${new Date().toISOString()}

## Color Palette

\`\`\`json
${JSON.stringify(Object.fromEntries(Object.entries(designTokens.colors).slice(0, 15)), null, 2)}
\`\`\`

## Typography

### Font Families
\`\`\`
${designTokens.typography.fonts.slice(0, 10).join('\n')}
\`\`\`

### Font Sizes
\`\`\`
${designTokens.typography.sizes.slice(0, 10).join('\n')}
\`\`\`

### Font Weights
\`\`\`
${designTokens.typography.weights.join(', ')}
\`\`\`

## Spacing

\`\`\`json
${JSON.stringify(designTokens.spacing.values?.slice(0, 10), null, 2)}
\`\`\`

## Border Radius

\`\`\`json
${JSON.stringify(designTokens.borderRadius.slice(0, 10), null, 2)}
\`\`\`

## Shadows

\`\`\`json
${JSON.stringify(designTokens.shadows.slice(0, 5), null, 2)}
\`\`\`

## CSS Variables

\`\`\`json
${JSON.stringify(designTokens.cssVariables, null, 2)}
\`\`\`

## Tailwind Classes Used

Top 10 most used Tailwind classes:
\`\`\`
${tailwindAnalysis.topClasses.slice(0, 10).join('\n')}
\`\`\`

Total: ${tailwindAnalysis.totalClasses} unique classes

## Responsive Breakpoints

\`\`\`
${responsiveInfo.mediaQueries.join('\n')}
\`\`\`

Viewport Meta:
\`\`\`
${responsiveInfo.viewportMeta}
\`\`\`
`;

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'design-tokens.md'),
      tokenDocs
    );

    console.log('✓ Created design tokens documentation');

    console.log('\n✅ Design token extraction complete!');
    console.log(`\nExtracted:`);
    console.log(`  • ${Object.keys(designTokens.colors).length} colors`);
    console.log(`  • ${designTokens.typography.fonts.length} font families`);
    console.log(`  • ${designTokens.typography.sizes.length} font sizes`);
    console.log(`  • ${tailwindAnalysis.totalClasses} Tailwind classes`);
    console.log(`  • ${responsiveInfo.mediaQueries.length} media queries`);

    console.log('\nGenerated files:');
    console.log('  • analysis/design-tokens.json');
    console.log('  • analysis/design-tokens.md');
    console.log('  • analysis/tailwind.config.template.js');

  } catch (error) {
    console.error('❌ Error during extraction:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run extraction
extractDesignTokens().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
