#!/bin/zsh

cd "$(dirname "$0")"

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js / npm is not installed on this Mac."
  echo ""
  echo "Please install Node.js from:"
  echo "https://nodejs.org"
  echo ""
  echo "After installing it, double-click START-WEBSITE.command again."
  echo ""
  read "reply?Press Enter to close this window."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing website dependencies. This may take a minute..."
  npm install --cache .npm-cache
fi

echo ""
echo "Starting the booking website..."
echo "Open this address in your browser:"
echo "http://localhost:4242"
echo ""
echo "Keep this window open while you test the site."
echo ""

open "http://localhost:4242" >/dev/null 2>&1 || true
npm start
