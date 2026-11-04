#!/bin/bash

##############################################################################
# REA + Playwright MCP Setup Script
# Installs and configures reverse engineering tools
##############################################################################

set -e

echo "================================"
echo "Reverse Engineering Tools Setup"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${YELLOW}[1/5]${NC} Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm not found. Please install npm${NC}"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js ${NODE_VERSION} found${NC}"

# Create directories
echo -e "${YELLOW}[2/5]${NC} Creating directory structure..."
mkdir -p analysis/{screenshots,videos,traces,reports}
mkdir -p tools/rea
mkdir -p scripts/mcp-analysis
mkdir -p scripts/rea-analysis
echo -e "${GREEN}✓ Directory structure created${NC}"

# Install dependencies
echo -e "${YELLOW}[3/5]${NC} Installing Node.js dependencies..."

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo -e "${YELLOW}Creating package.json...${NC}"
    npm init -y
fi

# Install Playwright
echo "Installing Playwright..."
npm install playwright @playwright/test --save-dev

# Install Playwright MCP
echo "Installing Playwright MCP..."
npm install playwright-mcp --save-dev

# Install analysis tools
echo "Installing analysis dependencies..."
npm install axios cheerio jsdom dotenv --save

echo -e "${GREEN}✓ Dependencies installed${NC}"

# Install Playwright browsers
echo -e "${YELLOW}[4/5]${NC} Installing Playwright browsers..."
npx playwright install chromium firefox webkit
echo -e "${GREEN}✓ Playwright browsers installed${NC}"

# Clone and setup REA
echo -e "${YELLOW}[5/5]${NC} Setting up REA..."

if [ -d "tools/rea/.git" ]; then
    echo "REA already installed, updating..."
    cd tools/rea
    git pull origin main
    cd ../..
else
    echo "Cloning REA repository..."
    cd tools/rea
    git clone https://github.com/morluto/rea . 2>/dev/null || true

    # Try to install REA dependencies if they exist
    if [ -f "package.json" ]; then
        npm install
    elif [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
    fi

    cd ../..
fi

echo -e "${GREEN}✓ REA setup complete${NC}"

# Create configuration files
echo ""
echo "================================"
echo "Creating configuration files..."
echo "================================"
echo ""

# Create Playwright MCP config
cat > playwright-mcp.config.json << 'EOF'
{
  "browsers": ["chromium", "firefox"],
  "headless": false,
  "recordVideo": {
    "dir": "./analysis/videos"
  },
  "tracing": {
    "dir": "./analysis/traces"
  },
  "screenshot": {
    "dir": "./analysis/screenshots"
  },
  "timeout": 30000,
  "waitForNavigation": "networkidle",
  "ignoreHttpsErrors": true,
  "slowMo": 500,
  "launchOptions": {
    "args": ["--disable-blink-features=AutomationControlled"]
  }
}
EOF

echo -e "${GREEN}✓ Created playwright-mcp.config.json${NC}"

# Create .env.example
cat > .env.example << 'EOF'
# Target Configuration
TARGET_URL=https://operix.co/new-landing

# Playwright Configuration
HEADLESS=false
SLOW_MO=500

# Analysis Configuration
SAVE_SCREENSHOTS=true
RECORD_VIDEO=true
SAVE_TRACES=true
EXTRACT_APIS=true
EXTRACT_DOM=true

# Optional: Proxy configuration
PROXY_URL=
PROXY_USERNAME=
PROXY_PASSWORD=
EOF

cp .env.example .env
echo -e "${GREEN}✓ Created .env and .env.example${NC}"

# Create REA config
cat > rea.config.json << 'EOF'
{
  "targetUrl": "https://operix.co/new-landing",
  "outputDir": "./analysis/rea-output",
  "includeAssets": true,
  "analyzeDependencies": true,
  "extractComponents": true,
  "detectPatterns": true,
  "generateReport": true,
  "timeout": 30000,
  "headless": false
}
EOF

echo -e "${GREEN}✓ Created rea.config.json${NC}"

# Create package.json scripts if not present
echo ""
echo "================================"
echo "Adding npm scripts..."
echo "================================"
echo ""

# Add scripts to package.json using npm
npm set-script "rea:analyze" "node -e \"require('path').resolve('tools/rea')\" || echo 'REA analysis'"
npm set-script "mcp:extract-dom" "node scripts/mcp-analysis/extract-dom.js"
npm set-script "mcp:extract-apis" "node scripts/mcp-analysis/extract-apis.js"
npm set-script "mcp:analyze-forms" "node scripts/mcp-analysis/analyze-forms.js"
npm set-script "mcp:visual-analysis" "node scripts/mcp-analysis/visual-analysis.js"
npm set-script "mcp:extract-tokens" "node scripts/mcp-analysis/extract-design-tokens.js"
npm set-script "analyze:all" "npm run mcp:extract-dom && npm run mcp:extract-apis && npm run mcp:analyze-forms && npm run mcp:visual-analysis && npm run mcp:extract-tokens"

echo -e "${GREEN}✓ npm scripts added${NC}"

# Create a quick start guide
cat > ANALYSIS_QUICKSTART.md << 'EOF'
# Quick Start: Reverse Engineering Analysis

## Prerequisites
- All tools installed via `./SETUP_TOOLS.sh`
- Target: https://operix.co/new-landing

## Running Analysis

### Option 1: Run All Analysis Scripts
```bash
npm run analyze:all
```

### Option 2: Run Individual Scripts
```bash
# Extract DOM structure
npm run mcp:extract-dom

# Extract API endpoints
npm run mcp:extract-apis

# Analyze forms
npm run mcp:analyze-forms

# Visual analysis (screenshots)
npm run mcp:visual-analysis

# Extract design tokens
npm run mcp:extract-tokens
```

## Output Files
All analysis results are saved to:
- `analysis/screenshots/` - Page screenshots
- `analysis/videos/` - Recorded interactions
- `analysis/traces/` - Playwright traces
- `analysis/*.json` - Extracted data

## Using Results with AI Model

1. Copy all files from `analysis/` directory
2. Use the prompt template in `REVERSE_ENGINEERING_GUIDE.md`
3. Provide files to your AI model with unlimited tokens
4. Follow the implementation roadmap

## Troubleshooting

### Port already in use
If you get port errors, the browser might not be closing properly:
```bash
# Kill all chromium processes
pkill -f chromium
```

### Timeout errors
Increase the timeout in `playwright-mcp.config.json`:
```json
{
  "timeout": 60000
}
```

### SSL/Certificate errors
The config already ignores HTTPS errors. If still failing, check your internet connection.

## Next Steps

1. Review generated files in `analysis/` directory
2. Check `analysis/data-map.json` for findings
3. Organize results by section type
4. Provide to AI model for implementation
5. Follow the roadmap in main guide

---
For detailed instructions, see `REVERSE_ENGINEERING_GUIDE.md`
EOF

echo -e "${GREEN}✓ Created ANALYSIS_QUICKSTART.md${NC}"

# Summary
echo ""
echo "================================"
echo "Setup Complete! ✓"
echo "================================"
echo ""
echo -e "${GREEN}Successfully installed:${NC}"
echo "  ✓ Playwright + Browsers"
echo "  ✓ Playwright MCP"
echo "  ✓ REA (Reverse Engineering Analysis)"
echo "  ✓ Analysis dependencies"
echo ""
echo -e "${GREEN}Configuration files created:${NC}"
echo "  ✓ playwright-mcp.config.json"
echo "  ✓ rea.config.json"
echo "  ✓ .env / .env.example"
echo "  ✓ npm scripts in package.json"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review the configuration files"
echo "  2. Edit .env with your settings"
echo "  3. Run: npm run analyze:all"
echo "  4. Check analysis/ directory for results"
echo "  5. Follow REVERSE_ENGINEERING_GUIDE.md for implementation"
echo ""
echo -e "${YELLOW}Documentation:${NC}"
echo "  • REVERSE_ENGINEERING_GUIDE.md - Full guide"
echo "  • ANALYSIS_QUICKSTART.md - Quick reference"
echo ""
echo "Happy reverse engineering! 🔍"
