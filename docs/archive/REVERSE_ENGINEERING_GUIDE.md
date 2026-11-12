# Reverse Engineering Guide: Operix.co Landing Page

## Building a Free Next.js + Supabase Alternative

**Created:** 2026-11-04  
**Target:** https://operix.co/new-landing  
**Tech Stack:** Next.js 14+, Supabase, Playwright MCP, REA (Reverse Engineering Analysis)

---

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Tool Installation](#tool-installation)
3. [Reverse Engineering Methodology](#reverse-engineering-methodology)
4. [Analysis Framework](#analysis-framework)
5. [Implementation Roadmap](#implementation-roadmap)
6. [Detailed Instructions for AI Models](#detailed-instructions-for-ai-models)

---

## Environment Setup

### Prerequisites

- Node.js 18+ installed
- Git initialized repository
- Unlimited token access to Claude (or your preferred AI model)
- Browser with DevTools capability

### Initial Setup

```bash
# Initialize Next.js project structure
npm create next-app@latest operix-clone --typescript --tailwind --eslint

cd operix-clone

# Install essential dependencies
npm install playwright @playwright/test
npm install @supabase/supabase-js
npm install axios cheerio jsdom puppeteer

# Dev dependencies for analysis
npm install --save-dev @types/node @types/react
npm install --save-dev prettier eslint
```

---

## Tool Installation

### 1. REA (Reverse Engineering Analysis) Integration

**Repository:** https://github.com/morluto/rea  
**Purpose:** Automated code decompilation, structural analysis, and dependency mapping

#### Installation Steps

```bash
# Clone REA into your project tools directory
mkdir -p tools/rea
cd tools/rea

git clone https://github.com/morluto/rea .

# Install REA dependencies (check repo for specific requirements)
npm install
# OR if using Python backend
pip install -r requirements.txt

# Create configuration file
cat > rea.config.json << 'EOF'
{
  "targetUrl": "https://operix.co/new-landing",
  "outputDir": "./analysis/rea-output",
  "includeAssets": true,
  "analyzeDependencies": true,
  "extractComponents": true,
  "detectPatterns": true,
  "generateReport": true
}
EOF

# Run REA analysis
npm run analyze
# OR
python rea.py --config rea.config.json
```

**REA Output Structure:**

- Component hierarchy mapping
- Dependency graphs
- API endpoint detection
- Database schema inference
- Authentication flow analysis
- Styling architecture (Tailwind/CSS analysis)

---

### 2. Playwright MCP Installation

**Repository:** https://github.com/microsoft/playwright-mcp  
**Purpose:** Browser automation, dynamic content analysis, interaction recording

#### Installation Steps

```bash
# Install Playwright MCP
npm install playwright-mcp
# OR globally
npm install -g playwright-mcp

# Create MCP configuration
cat > playwright-mcp.config.json << 'EOF'
{
  "browsers": ["chromium"],
  "headless": false,
  "recordVideo": true,
  "videoDir": "./analysis/recordings",
  "tracing": true,
  "tracingDir": "./analysis/traces",
  "timeout": 30000,
  "waitForNavigation": "networkidle"
}
EOF

# Initialize Playwright browsers
npx playwright install

# Create analysis scripts directory
mkdir -p scripts/mcp-analysis
```

#### Key Playwright MCP Capabilities for Reverse Engineering

```javascript
// scripts/mcp-analysis/extract-dom.js
const { chromium } = require("playwright");

async function analyzeDOM() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("https://operix.co/new-landing", {
    waitUntil: "networkidle",
  });

  // Extract DOM structure
  const dom = await page.evaluate(() => {
    return {
      html: document.documentElement.outerHTML,
      scripts: Array.from(document.scripts).map((s) => ({
        src: s.src,
        inline: s.textContent.substring(0, 200),
      })),
      stylesheets: Array.from(document.styleSheets).map((s) => s.href),
      metadata: {
        title: document.title,
        description: document.querySelector('meta[name="description"]')
          ?.content,
        ogImage: document.querySelector('meta[property="og:image"]')?.content,
      },
    };
  });

  return dom;
}

module.exports = { analyzeDOM };
```

---

## Reverse Engineering Methodology

### Phase 1: Static Analysis (8-10 hours)

#### 1.1 Page Structure Extraction

```bash
# Extract raw HTML
curl -s https://operix.co/new-landing > raw-page.html

# Parse with cheerio
node scripts/extract-structure.js
```

**Deliverables:**

- [ ] Complete DOM tree mapping
- [ ] Component hierarchy documented
- [ ] CSS class naming conventions identified
- [ ] Asset inventory (images, fonts, videos)

#### 1.2 Dependency Analysis

```bash
# Use REA to map dependencies
npm run rea:analyze-deps

# Analyze network requests (static)
grep -o 'src="[^"]*"' raw-page.html | sort -u > static-assets.txt
grep -o 'href="[^"]*"' raw-page.html | sort -u >> static-assets.txt
```

**Analyze:**

- Third-party libraries (React, Vue, Angular, Svelte versions)
- CSS frameworks (Tailwind, Bootstrap, custom CSS)
- Icon libraries (FontAwesome, custom SVG)
- Analytics/tracking code
- CMS or backend framework clues

#### 1.3 Styling Architecture

```bash
# Extract all stylesheets
mkdir -p analysis/styles

# Download and analyze CSS
for url in $(grep -o 'href="[^"]*\.css[^"]*"' raw-page.html | cut -d'"' -f2); do
  curl -s "$url" > "analysis/styles/$(basename $url)"
done

# Analyze Tailwind usage
grep -o 'class="[^"]*"' raw-page.html | sort -u > analysis/tailwind-classes.txt
```

**Document:**

- [ ] Color palette (primary, secondary, accent colors)
- [ ] Typography (fonts, sizes, weights)
- [ ] Spacing system (margins, padding scale)
- [ ] Responsive breakpoints
- [ ] Component styling patterns

---

### Phase 2: Dynamic Analysis (10-12 hours)

#### 2.1 Interaction Recording with Playwright MCP

```javascript
// scripts/mcp-analysis/record-interactions.js
const { chromium } = require("playwright");
const fs = require("fs");

async function recordInteractions() {
  const browser = await chromium.launch({
    headless: false,
    recordVideo: { dir: "analysis/videos" },
  });

  const context = await browser.newContext({
    recordVideo: { dir: "analysis/videos" },
  });

  const page = await context.newPage();

  // Enable request/response logging
  page.on("request", (request) => {
    console.log("REQUEST:", request.method(), request.url());
    logRequest(request);
  });

  page.on("response", (response) => {
    console.log("RESPONSE:", response.status(), response.url());
    logResponse(response);
  });

  await page.goto("https://operix.co/new-landing", {
    waitUntil: "networkidle",
  });

  // Simulate user interactions
  const interactions = [
    { action: "hover", selector: "header" },
    { action: "click", selector: '[data-testid="cta-button"]' },
    { action: "scroll", amount: 500 },
    { action: "hover", selector: ".feature-card" },
  ];

  for (const interaction of interactions) {
    await performInteraction(page, interaction);
    await page.waitForTimeout(1000);
  }

  await browser.close();
}

async function performInteraction(page, interaction) {
  try {
    const element = await page.$(interaction.selector).catch(() => null);

    if (!element) {
      console.log(`Element not found: ${interaction.selector}`);
      return;
    }

    switch (interaction.action) {
      case "click":
        await element.click();
        break;
      case "hover":
        await element.hover();
        break;
      case "scroll":
        await page.evaluate(
          (amt) => window.scrollBy(0, amt),
          interaction.amount,
        );
        break;
    }
  } catch (e) {
    console.error("Interaction error:", e.message);
  }
}

function logRequest(request) {
  const log = {
    method: request.method(),
    url: request.url(),
    headers: request.headers(),
    postData: request.postData(),
    timestamp: new Date().toISOString(),
  };
  fs.appendFileSync("analysis/requests.json", JSON.stringify(log) + "\n");
}

function logResponse(response) {
  const log = {
    status: response.status(),
    url: response.url(),
    contentType: response.headers()["content-type"],
    timestamp: new Date().toISOString(),
  };
  fs.appendFileSync("analysis/responses.json", JSON.stringify(log) + "\n");
}

module.exports = { recordInteractions };
```

#### 2.2 API Endpoint Discovery

```javascript
// scripts/mcp-analysis/extract-apis.js
const { chromium } = require("playwright");

async function extractAPIEndpoints() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  const apiCalls = [];
  const networkData = [];

  page.on("response", async (response) => {
    const url = response.url();

    if (
      url.includes("/api/") ||
      url.includes("graphql") ||
      response.headers()["content-type"]?.includes("json")
    ) {
      try {
        const body = await response.text();
        networkData.push({
          method: response.request().method(),
          url: url,
          status: response.status(),
          body: body,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.log("Could not read response body");
      }
    }
  });

  await page.goto("https://operix.co/new-landing", {
    waitUntil: "networkidle",
  });

  // Trigger additional interactions to discover more endpoints
  const buttons = await page.$$('button, a[href*="#"], [onclick]');
  for (const button of buttons.slice(0, 10)) {
    try {
      await button.click();
      await page.waitForTimeout(500);
      await page.goBack().catch(() => null);
    } catch (e) {
      // Ignore errors
    }
  }

  return networkData;
}

module.exports = { extractAPIEndpoints };
```

#### 2.3 Form Analysis

```javascript
// scripts/mcp-analysis/analyze-forms.js
const { chromium } = require("playwright");

async function analyzeForms() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("https://operix.co/new-landing", {
    waitUntil: "networkidle",
  });

  const forms = await page.evaluate(() => {
    return Array.from(document.forms).map((form) => ({
      id: form.id,
      name: form.name,
      action: form.action,
      method: form.method,
      fields: Array.from(form.elements).map((field) => ({
        type: field.type,
        name: field.name,
        id: field.id,
        placeholder: field.placeholder,
        required: field.required,
        validation: field.getAttribute("pattern"),
        classes: field.className,
      })),
    }));
  });

  await browser.close();
  return forms;
}

module.exports = { analyzeForms };
```

---

### Phase 3: Visual Design Extraction (6-8 hours)

#### 3.1 Screenshot Analysis

```javascript
// scripts/mcp-analysis/visual-analysis.js
const { chromium } = require("playwright");

async function captureVisuals() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const viewports = [
    { width: 1920, height: 1080, name: "desktop" },
    { width: 768, height: 1024, name: "tablet" },
    { width: 375, height: 667, name: "mobile" },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("https://operix.co/new-landing", {
      waitUntil: "networkidle",
    });

    // Capture full page screenshot
    await page.screenshot({
      path: `analysis/screenshots/${viewport.name}-full.png`,
      fullPage: true,
    });

    // Capture individual sections
    const sections = await page.$$(
      '[data-section], section, [class*="section"], [class*="hero"]',
    );
    for (let i = 0; i < sections.length; i++) {
      await sections[i].screenshot({
        path: `analysis/screenshots/${viewport.name}-section-${i}.png`,
      });
    }
  }

  await browser.close();
}

module.exports = { captureVisuals };
```

#### 3.2 Color & Design Token Extraction

```javascript
// scripts/mcp-analysis/extract-design-tokens.js
const { chromium } = require("playwright");

async function extractDesignTokens() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("https://operix.co/new-landing", {
    waitUntil: "networkidle",
  });

  const tokens = await page.evaluate(() => {
    const colors = new Set();
    const fonts = new Set();
    const sizes = new Set();

    // Extract from computed styles
    document.querySelectorAll("*").forEach((el) => {
      const styles = window.getComputedStyle(el);

      // Colors
      colors.add(styles.color);
      colors.add(styles.backgroundColor);
      colors.add(styles.borderColor);

      // Fonts
      fonts.add(styles.fontFamily);
      fonts.add(styles.fontSize);
      fonts.add(styles.fontWeight);

      // Sizes
      sizes.add(styles.width);
      sizes.add(styles.height);
    });

    return {
      colors: Array.from(colors).filter((c) => c && c !== "rgba(0, 0, 0, 0)"),
      fonts: Array.from(fonts),
      sizes: Array.from(sizes).filter((s) => s),
    };
  });

  await browser.close();
  return tokens;
}

module.exports = { extractDesignTokens };
```

---

### Phase 4: Content Structure Mapping (4-6 hours)

#### 4.1 Content Inventory

```javascript
// scripts/mcp-analysis/map-content.js
const { chromium } = require("playwright");

async function mapContent() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("https://operix.co/new-landing", {
    waitUntil: "networkidle",
  });

  const content = await page.evaluate(() => {
    return {
      headings: Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map(
        (h) => ({
          level: h.tagName,
          text: h.textContent.trim(),
          id: h.id,
          classes: h.className,
        }),
      ),
      paragraphs: Array.from(document.querySelectorAll("p"))
        .slice(0, 20)
        .map((p) => ({
          text: p.textContent.trim(),
          classes: p.className,
        })),
      buttons: Array.from(
        document.querySelectorAll('button, a[class*="btn"], [class*="button"]'),
      ).map((b) => ({
        text: b.textContent.trim(),
        href: b.href,
        classes: b.className,
        onclick: b.getAttribute("onclick"),
      })),
      links: Array.from(document.querySelectorAll("a")).map((a) => ({
        text: a.textContent.trim(),
        href: a.href,
        target: a.target,
      })),
      images: Array.from(document.querySelectorAll("img")).map((img) => ({
        src: img.src,
        alt: img.alt,
        title: img.title,
        classes: img.className,
      })),
    };
  });

  await browser.close();
  return content;
}

module.exports = { mapContent };
```

---

## Analysis Framework

### Data Collection Template

Create `analysis/data-map.json`:

```json
{
  "project": "operix-clone",
  "targetUrl": "https://operix.co/new-landing",
  "analysisDate": "2026-11-04",
  "sections": [
    {
      "name": "Hero Section",
      "components": ["Heading", "Subheading", "CTA Button", "Background Image"],
      "functionality": ["Scroll animation", "Button click tracking"],
      "styling": {
        "backgroundColor": "#...",
        "typography": "primary font"
      }
    },
    {
      "name": "Features Section",
      "components": ["Feature Cards", "Icons", "Descriptions"],
      "layout": "grid",
      "responsive": {
        "desktop": "3 columns",
        "tablet": "2 columns",
        "mobile": "1 column"
      }
    }
  ],
  "apis": [
    {
      "endpoint": "/api/...",
      "method": "POST/GET",
      "purpose": "description",
      "authentication": "none/Bearer"
    }
  ],
  "database": {
    "type": "inferred",
    "tables": [],
    "relationships": []
  }
}
```

---

## Implementation Roadmap

### Week 1: Foundation & Setup

- [ ] Install Next.js project with TypeScript
- [ ] Set up Supabase project and authentication
- [ ] Complete static analysis (REA)
- [ ] Extract design tokens and create Tailwind config
- [ ] Set up component library structure

### Week 2: Core Features

- [ ] Build Hero section component
- [ ] Implement Features section
- [ ] Create reusable component patterns
- [ ] Set up responsive design
- [ ] Implement dark mode support

### Week 3: Dynamic Features

- [ ] Build contact/form components
- [ ] Integrate Supabase authentication
- [ ] Set up API routes for form handling
- [ ] Implement email notifications
- [ ] Add analytics tracking

### Week 4: Polish & Optimization

- [ ] Performance optimization
- [ ] SEO optimization
- [ ] Accessibility audit
- [ ] Cross-browser testing
- [ ] Mobile responsiveness refinement
- [ ] Deployment setup (Vercel/Railway)

---

## Detailed Instructions for AI Models

### Instructions for Claude or Other AI Models with Unlimited Tokens

**Context:** You are tasked with building a Next.js + Supabase clone of operix.co/new-landing based on detailed reverse engineering analysis.

#### Step 1: Analysis Phase (Input to AI Model)

Provide the following artifacts to your AI model:

**A. DOM Structure Export**

```
File: analysis/dom-structure.json
Content: Complete DOM tree, component hierarchy, CSS classes
Format: JSON with nested element structure
```

**B. CSS Analysis**

```
File: analysis/styles/tailwind-analysis.md
Content:
- All Tailwind classes used
- Color palette (extracted hex codes)
- Font families and sizing scale
- Spacing scale
- Responsive breakpoints used
- Custom CSS if any
```

**C. API Endpoints**

```
File: analysis/api-endpoints.json
Content:
- Endpoint paths
- HTTP methods
- Request payloads
- Response formats
- Authentication requirements
```

**D. Content Inventory**

```
File: analysis/content-map.json
Content:
- All headings, copy text
- CTA texts
- Form labels and placeholders
- Navigation structure
- Meta descriptions
```

**E. Component Map**

```
File: analysis/components.md
Content:
## Components Identified

### Header
- Navigation bar
- Logo
- Mobile menu
- Search bar

### Hero Section
- Large heading
- Subheading
- CTA button
- Background video/image

### Feature Cards
- Card component
- Icon
- Title
- Description
- Link

### Forms
- Contact form
- Newsletter signup
- Demo request form

### Footer
- Links
- Social icons
- Copyright
- Newsletter signup
```

#### Step 2: Prompt Template for AI Model

```markdown
# Build Next.js Clone of Operix.co Landing Page

## Project Specifications

**Tech Stack:**

- Framework: Next.js 14 with TypeScript
- Styling: Tailwind CSS
- Database: Supabase
- UI Components: shadcn/ui (optional)
- Deployment: Vercel

**Analysis Data:**
[Attach all analysis files from Phase 1-4]

## Implementation Requirements

### 1. Project Structure

Create the following structure:
```

app/
├── components/
│ ├── layout/
│ │ ├── Header.tsx
│ │ ├── Footer.tsx
│ │ └── Navigation.tsx
│ ├── sections/
│ │ ├── HeroSection.tsx
│ │ ├── FeaturesSection.tsx
│ │ ├── PricingSection.tsx
│ │ └── CTASection.tsx
│ ├── ui/
│ │ ├── Button.tsx
│ │ ├── Card.tsx
│ │ ├── Modal.tsx
│ │ └── Form.tsx
│ └── common/
├── app/
│ ├── page.tsx (landing page)
│ ├── layout.tsx (root layout)
│ └── api/
│ ├── contact/route.ts
│ ├── newsletter/route.ts
│ └── demo/route.ts
├── lib/
│ ├── supabase.ts
│ ├── constants.ts
│ └── utils.ts
├── styles/
│ └── globals.css
└── public/
├── images/
└── icons/

```

### 2. Design System Implementation

Based on extracted tokens:
- Create Tailwind config extending colors
- Define CSS custom properties for consistency
- Build component variants (primary, secondary, etc.)
- Implement dark mode support

### 3. Database Schema (Supabase)

Create tables for:
- Contacts (from contact form)
- Newsletter subscribers
- Demo requests
- Analytics events

### 4. Features to Implement

1. **Responsive Design**
   - Mobile-first approach
   - Breakpoints: sm(640px), md(768px), lg(1024px), xl(1280px)
   - Touch-friendly interactions

2. **Forms**
   - Client-side validation
   - Server-side validation
   - Error handling
   - Success messages
   - Spam protection (reCAPTCHA optional)

3. **Performance**
   - Image optimization (Next.js Image)
   - Code splitting
   - Lazy loading
   - Dynamic imports

4. **SEO**
   - Meta tags
   - Open Graph
   - Structured data
   - Sitemap

5. **Analytics**
   - Track page views
   - Track CTA clicks
   - Form submissions
   - User interactions

### 5. Coding Standards

- Use TypeScript strictly
- Follow Next.js 14 conventions
- Use functional components with hooks
- Implement error boundaries
- Add proper loading states
- Include accessibility (ARIA labels, keyboard navigation)

### 6. Authentication (Optional for Future)

- Email/password signup
- Social login (Google, GitHub)
- Email verification
- Password reset flow

## Deliverables

1. Complete Next.js project
2. All components fully styled matching target design
3. Supabase integration working
4. Forms handling data correctly
5. Responsive on all devices
6. SEO optimized
7. README with setup instructions
8. Environment variables template (.env.example)

## Files to Generate

### 1. Component Files
- [ ] app/components/layout/Header.tsx
- [ ] app/components/layout/Footer.tsx
- [ ] app/components/sections/HeroSection.tsx
- [ ] app/components/sections/FeaturesSection.tsx
- [ ] app/components/ui/Button.tsx
- [ ] app/components/ui/Card.tsx

### 2. API Routes
- [ ] app/api/contact/route.ts
- [ ] app/api/newsletter/route.ts

### 3. Configuration
- [ ] tailwind.config.ts
- [ ] next.config.js
- [ ] tsconfig.json

### 4. Styling
- [ ] app/globals.css
- [ ] Component-level CSS modules

### 5. Database
- [ ] Database schema SQL
- [ ] Supabase setup guide

## Success Criteria

- [ ] All components render without errors
- [ ] Styles match target design (90%+ accuracy)
- [ ] Forms submit data to Supabase
- [ ] Fully responsive on mobile/tablet/desktop
- [ ] Lighthouse score: 90+ on all metrics
- [ ] No TypeScript errors
- [ ] Code is clean and well-commented
- [ ] Ready for deployment

## Important Notes

1. Use the exact colors, fonts, spacing from analysis data
2. Match animations and interactions from original
3. Ensure all interactive elements are accessible
4. Optimize images for web
5. Use environment variables for sensitive data
6. Test thoroughly before deployment
```

#### Step 3: Post-Generation Instructions

1. **Review Generated Code**
   - Check component structure
   - Verify Tailwind classes match design tokens
   - Validate TypeScript types
   - Ensure accessibility compliance

2. **Testing Checklist**

   ```bash
   # Type checking
   npm run type-check

   # Linting
   npm run lint

   # Build
   npm run build

   # Development
   npm run dev
   ```

3. **Deployment Preparation**
   - Create `.env.local` with Supabase keys
   - Configure Supabase database
   - Set up email service (SendGrid/Resend)
   - Configure analytics
   - Deploy to Vercel

---

## Installation Commands Summary

```bash
# Install tools in project
npm install playwright @playwright/test axios cheerio jsdom

# Clone REA
git clone https://github.com/morluto/rea tools/rea
cd tools/rea && npm install

# Install Playwright MCP
npm install playwright-mcp
npx playwright install

# Run analysis scripts
node scripts/extract-structure.js
node scripts/mcp-analysis/record-interactions.js
node scripts/mcp-analysis/extract-apis.js
node scripts/mcp-analysis/analyze-forms.js
node scripts/mcp-analysis/visual-analysis.js
```

---

## File Organization

```
project-root/
├── analysis/
│   ├── screenshots/
│   ├── videos/
│   ├── traces/
│   ├── dom-structure.json
│   ├── api-endpoints.json
│   ├── content-map.json
│   ├── design-tokens.json
│   └── data-map.json
├── tools/
│   ├── rea/
│   └── mcp/
├── scripts/
│   ├── extract-structure.js
│   ├── mcp-analysis/
│   │   ├── extract-dom.js
│   │   ├── extract-apis.js
│   │   ├── analyze-forms.js
│   │   ├── visual-analysis.js
│   │   └── extract-design-tokens.js
├── app/
├── public/
├── package.json
└── REVERSE_ENGINEERING_GUIDE.md (this file)
```

---

## Tips for Reverse Engineering

### 1. Obfuscation Handling

- Minified code: Use online deobfuscators
- API endpoints: Check Network tab in DevTools
- Hidden endpoints: Monitor XHR requests

### 2. Detection Evasion Considerations

- Use proper User-Agent headers
- Respect robots.txt
- Don't overload servers with requests
- Add delays between requests

### 3. Legal Considerations

- Building a clone for personal use is generally acceptable
- Avoid copying proprietary business logic
- Create original functionality
- Respect terms of service
- Don't use identical copy/content

### 4. Dynamic Content

- Use Playwright for JavaScript-heavy sites
- Wait for network idle
- Handle modal dialogs
- Check for lazy-loaded content

---

## Resources

- [Playwright Docs](https://playwright.dev)
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com)
- [Web DevTools Guide](https://developer.chrome.com/docs/devtools/)

---

## Next Steps

1. **Install tools** following the instructions above
2. **Run analysis scripts** to collect data
3. **Organize findings** in analysis/ directory
4. **Provide data to AI model** using the prompt template
5. **Build implementation** following generated code
6. **Test thoroughly** before deployment
7. **Deploy to Vercel** with Supabase backend

---

**Last Updated:** 2026-11-04  
**Maintained By:** Ahmed Mohamed Tahaa  
**License:** MIT
