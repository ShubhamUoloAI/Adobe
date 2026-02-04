#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Output file for batch convert results
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="batch-convert-output-${TIMESTAMP}.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "========================================"
echo "InDesign Converter - Start & Convert"
echo "========================================"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping background processes...${NC}"
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        echo "Stopped frontend dev server (PID: $FRONTEND_PID)"
    fi
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo "Stopped backend dev server (PID: $BACKEND_PID)"
    fi
    exit
}

trap cleanup SIGINT SIGTERM

# Check for Node.js
echo -e "${BLUE}[1/7] Checking for Node.js...${NC}"
if ! command_exists node; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js found: $NODE_VERSION${NC}"
echo ""

# Check for npm
echo -e "${BLUE}[2/7] Checking for npm...${NC}"
if ! command_exists npm; then
    echo -e "${RED}✗ npm is not installed${NC}"
    exit 1
fi
NPM_VERSION=$(npm --version)
echo -e "${GREEN}✓ npm found: $NPM_VERSION${NC}"
echo ""

# Check Frontend dependencies
echo -e "${BLUE}[3/7] Checking Frontend dependencies...${NC}"
cd "$SCRIPT_DIR/Frontend" || exit 1
if [ ! -d "node_modules" ]; then
    echo "node_modules not found. Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Failed to install Frontend dependencies${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Frontend dependencies found${NC}"
fi
echo ""

# Check Backend dependencies
echo -e "${BLUE}[4/7] Checking Backend dependencies...${NC}"
cd "$SCRIPT_DIR/Backend" || exit 1
if [ ! -d "node_modules" ]; then
    echo "node_modules not found. Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Failed to install Backend dependencies${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Backend dependencies found${NC}"
fi
echo ""

# Start Frontend dev server
echo -e "${BLUE}[5/7] Starting Frontend dev server...${NC}"
cd "$SCRIPT_DIR/Frontend"
npm run dev > "$SCRIPT_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend dev server started (PID: $FRONTEND_PID)${NC}"
echo "   Running at: http://localhost:5173"
echo "   Logs: $SCRIPT_DIR/frontend.log"
echo ""

# Start Backend dev server
echo -e "${BLUE}[6/7] Starting Backend dev server...${NC}"
cd "$SCRIPT_DIR/Backend"
npm run dev > "$SCRIPT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend dev server started (PID: $BACKEND_PID)${NC}"
echo "   Running at: http://localhost:5000"
echo "   Logs: $SCRIPT_DIR/backend.log"
echo ""

# Wait for servers to start
echo "Waiting 8 seconds for servers to initialize..."
sleep 8
echo ""

# Check if servers are running
echo "Checking server health..."
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}✗ Frontend server failed to start. Check frontend.log for details.${NC}"
    cleanup
fi

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}✗ Backend server failed to start. Check backend.log for details.${NC}"
    cleanup
fi

echo -e "${GREEN}✓ Both servers are running${NC}"
echo ""

# Run batch convert
echo -e "${BLUE}[7/7] Running batch conversion...${NC}"
echo "You will be prompted to select folders in dialog boxes."
echo "Output will be saved to: $SCRIPT_DIR/$OUTPUT_FILE"
echo "========================================"
echo ""

cd "$SCRIPT_DIR/Backend"
npm run batch:convert 2>&1 | tee "$SCRIPT_DIR/$OUTPUT_FILE"

BATCH_EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "========================================"
if [ $BATCH_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ Batch conversion complete!${NC}"
else
    echo -e "${YELLOW}⚠ Batch conversion finished with errors${NC}"
fi
echo "Output saved to: $OUTPUT_FILE"
echo ""

# Stop background servers
echo -e "${YELLOW}Stopping background servers...${NC}"
if [ ! -z "$FRONTEND_PID" ]; then
    kill $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}✓ Stopped frontend dev server (PID: $FRONTEND_PID)${NC}"
fi

if [ ! -z "$BACKEND_PID" ]; then
    kill $BACKEND_PID 2>/dev/null
    echo -e "${GREEN}✓ Stopped backend dev server (PID: $BACKEND_PID)${NC}"
fi

echo ""
echo "Log files saved:"
echo "  - Batch conversion: $OUTPUT_FILE"
echo "  - Frontend logs:    frontend.log"
echo "  - Backend logs:     backend.log"
echo ""
echo -e "${GREEN}✓ All done! Script exiting...${NC}"
echo ""

exit $BATCH_EXIT_CODE
