#!/bin/bash

# Start Frontend with Node v22
echo "🚀 Starting Frontend with Node v22..."
echo "📱 Frontend will be available at http://localhost:5173"
echo "🔗 API calls will be proxied to http://localhost:5000"
echo ""

cd "$(dirname "$0")"

# Run vite directly with Node v22
/opt/homebrew/opt/node@22/bin/node node_modules/.bin/vite
