#!/bin/bash
# Development helper script for Specify MCP Server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Specify MCP Development Script${NC}"
echo ""

# Function to print section headers
print_header() {
    echo -e "${YELLOW}━━━ $1 ━━━${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
print_header "Checking Prerequisites"
if ! command_exists node; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Node.js$(node --version)${NC}"
fi

if ! command_exists npm; then
    echo -e "${RED}✗ npm is not installed${NC}"
    exit 1
else
    echo -e "${GREEN}✓ npm $(npm --version)${NC}"
fi

# Parse arguments
COMMAND=${1:-help}

case $COMMAND in
    install)
        print_header "Installing Dependencies"
        npm install
        echo -e "${GREEN}✓ Dependencies installed${NC}"
        ;;
    
    build)
        print_header "Building Project"
        npm run build
        echo -e "${GREEN}✓ Build complete${NC}"
        ;;
    
    dev)
        print_header "Starting Development Server"
        npm run dev
        ;;
    
    test)
        print_header "Running Tests"
        npm test
        ;;
    
    test:watch)
        print_header "Running Tests in Watch Mode"
        npm run test:watch
        ;;
    
    coverage)
        print_header "Running Test Coverage"
        npm run test:coverage
        ;;
    
    lint)
        print_header "Running Linter"
        npm run lint
        ;;
    
    lint:fix)
        print_header "Fixing Lint Issues"
        npm run lint:fix
        ;;
    
    format)
        print_header "Formatting Code"
        npm run format
        ;;
    
    typecheck)
        print_header "Type Checking"
        npm run typecheck
        ;;
    
    clean)
        print_header "Cleaning Build Artifacts"
        rm -rf dist coverage .specify
        echo -e "${GREEN}✓ Cleaned dist/, coverage/, and .specify/${NC}"
        ;;
    
    setup)
        print_header "Complete Setup"
        echo "1. Installing dependencies..."
        npm install
        echo ""
        echo "2. Building project..."
        npm run build
        echo ""
        echo "3. Running type check..."
        npm run typecheck
        echo ""
        echo -e "${GREEN}✓ Setup complete! Run './scripts/dev.sh dev' to start the server${NC}"
        ;;
    
    mcp:config)
        print_header "MCP Configuration"
        echo "Add this to your MCP settings:"
        echo ""
        echo '{'
        echo '  "mcpServers": {'
        echo '    "specify-mcp": {'
        echo '      "command": "node",'
        echo "      \"args\": [\"$(pwd)/dist/index.js\"]"
        echo '    }'
        echo '  }'
        echo '}'
        echo ""
        echo "Configuration file locations:"
        echo "  - Windsurf: ~/Library/Application Support/Windsurf/User/mcp-settings.json"
        echo "  - VS Code: Check your Continue.dev or similar extension settings"
        ;;
    
    help|*)
        print_header "Available Commands"
        echo "Usage: ./scripts/dev.sh [command]"
        echo ""
        echo "Commands:"
        echo "  install      - Install npm dependencies"
        echo "  build        - Build TypeScript to JavaScript"
        echo "  dev          - Start development server with hot reload"
        echo "  test         - Run tests"
        echo "  test:watch   - Run tests in watch mode"
        echo "  coverage     - Run tests with coverage report"
        echo "  lint         - Check for linting issues"
        echo "  lint:fix     - Fix linting issues"
        echo "  format       - Format code with Prettier"
        echo "  typecheck    - Run TypeScript type checking"
        echo "  clean        - Remove build artifacts"
        echo "  setup        - Complete setup (install, build, typecheck)"
        echo "  mcp:config   - Show MCP configuration"
        echo "  help         - Show this help message"
        echo ""
        echo "Quick Start:"
        echo "  1. ./scripts/dev.sh setup"
        echo "  2. ./scripts/dev.sh mcp:config"
        echo "  3. Add configuration to your IDE"
        echo "  4. ./scripts/dev.sh dev"
        ;;
esac
