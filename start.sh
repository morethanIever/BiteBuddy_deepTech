#!/bin/bash
# BiteBuddy — start both backend and frontend in split terminal

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}"
echo "  ██████╗ ██╗████████╗███████╗██████╗ ██╗   ██╗██████╗ ██████╗ ██╗   ██╗"
echo "  ██╔══██╗██║╚══██╔══╝██╔════╝██╔══██╗██║   ██║██╔══██╗██╔══██╗╚██╗ ██╔╝"
echo "  ██████╔╝██║   ██║   █████╗  ██████╔╝██║   ██║██║  ██║██║  ██║ ╚████╔╝ "
echo "  ██╔══██╗██║   ██║   ██╔══╝  ██╔══██╗██║   ██║██║  ██║██║  ██║  ╚██╔╝  "
echo "  ██████╔╝██║   ██║   ███████╗██████╔╝╚██████╔╝██████╔╝██████╔╝   ██║   "
echo "  ╚═════╝ ╚═╝   ╚═╝   ╚══════╝╚═════╝  ╚═════╝ ╚═════╝ ╚═════╝    ╚═╝   "
echo -e "${NC}"

echo -e "${BLUE}Starting BiteBuddy...${NC}"
echo ""

# Trap to kill both processes on exit
trap 'kill $(jobs -p) 2>/dev/null; exit' INT TERM EXIT

# Start backend
echo -e "${GREEN}[Backend]${NC} Starting on http://localhost:3001..."
cd backend && node src/index.js &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 3

# Start frontend
echo -e "${BLUE}[Frontend]${NC} Starting on http://localhost:5173..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🦠 App:       http://localhost:5173"
echo "  🔌 API:       http://localhost:3001"
echo "  📡 WebSocket: ws://localhost:3001/ws"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Press Ctrl+C to stop"
echo ""

wait
