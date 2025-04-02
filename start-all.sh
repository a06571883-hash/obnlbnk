#!/bin/bash

# Script to start both the main application and NFT server together
echo "🚀 Starting NFT marketplace application with full image server support..."

# Create a flag file to indicate the full start mode
touch .full_startup_mode

# Start the NFT server in the background
echo "📊 Starting NFT image server..."
node start-nft-server.js &
NFT_SERVER_PID=$!
echo "✅ NFT server started with PID: $NFT_SERVER_PID"

# Wait a moment for the NFT server to initialize
sleep 2

# Start the main application
echo "🌐 Starting main application..."
npm run dev

# Cleanup when the script is terminated
function cleanup() {
  echo "🛑 Shutting down all servers..."
  if [ -n "$NFT_SERVER_PID" ]; then
    kill $NFT_SERVER_PID
    echo "✅ NFT server stopped"
  fi
  rm -f .full_startup_mode
  exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for the main process to complete
wait