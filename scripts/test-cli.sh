#!/bin/bash

# CLI smoke test: install / uninstall flows

set -e

echo "🚀 Starting CLI tests..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Build
echo -e "${BLUE}📦 Step 1: Building...${NC}"
npm run build
echo -e "${GREEN}✓ Build done${NC}"
echo ""

# 2. Enter demo project
TEST_DIR="examples/demo"
if [ ! -d "$TEST_DIR" ]; then
    echo -e "${YELLOW}⚠️  Test directory missing: $TEST_DIR${NC}"
    exit 1
fi

cd "$TEST_DIR"
echo -e "${BLUE}📁 Entering: $TEST_DIR${NC}"
echo ""

# 3. Backup config files
echo -e "${BLUE}💾 Step 2: Backing up config files...${NC}"
if [ -f "vite.config.ts" ]; then
    cp vite.config.ts vite.config.ts.backup
    echo -e "${GREEN}✓ Backed up vite.config.ts${NC}"
fi
if [ -f "package.json" ]; then
    cp package.json package.json.backup
    echo -e "${GREEN}✓ Backed up package.json${NC}"
fi
echo ""

# 4. Test install
echo -e "${BLUE}📥 Step 3: Testing install...${NC}"
echo "Running: node ../../packages/plugin/dist/cli/index.js install"
echo ""
node ../../packages/plugin/dist/cli/index.js install
echo ""
echo -e "${GREEN}✓ Install test done${NC}"
echo ""

read -p "Press Enter to continue with uninstall test..."
echo ""

# 5. Test uninstall
echo -e "${BLUE}📤 Step 4: Testing uninstall...${NC}"
echo "Running: node ../../packages/plugin/dist/cli/index.js uninstall"
echo ""
node ../../packages/plugin/dist/cli/index.js uninstall
echo ""
echo -e "${GREEN}✓ Uninstall test done${NC}"
echo ""

# 6. Restore backups?
read -p "Restore backup files? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🔄 Restoring backups...${NC}"
    if [ -f "vite.config.ts.backup" ]; then
        mv vite.config.ts.backup vite.config.ts
        echo -e "${GREEN}✓ Restored vite.config.ts${NC}"
    fi
    if [ -f "package.json.backup" ]; then
        mv package.json.backup package.json
        echo -e "${GREEN}✓ Restored package.json${NC}"
    fi
fi

echo ""
echo -e "${GREEN}✅ All tests finished.${NC}"

