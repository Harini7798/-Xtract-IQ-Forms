#!/usr/bin/env bash
# Build script for Render deployment

set -o errexit  # Exit on error

echo "📦 Installing Python dependencies..."
pip install --upgrade pip
pip install psycopg2-binary

echo "📦 Installing Node.js dependencies..."
npm install

echo "✅ Build completed successfully!"
