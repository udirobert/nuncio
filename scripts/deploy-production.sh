#!/bin/bash

# nuncio Production Deploy Script
# Automates the update process on a remote Vultr/Coolify server using sshpass.
# 
# Usage:
# 1. Ensure you have sshpass installed locally.
# 2. Run: SSH_PASS=your_password SERVER_IP=your_ip PROJECT_PATH=/path/to/nuncio ./scripts/deploy-production.sh

set -e

# Configuration
USER=${SSH_USER:-"deploy"}
IP=${SERVER_IP}
PASS=${SSH_PASS}
DIR=${PROJECT_PATH:-"/opt/nuncio"}

# Validation
if [ -z "$IP" ] || [ -z "$PASS" ]; then
  echo "Error: SERVER_IP and SSH_PASS environment variables are required."
  echo "Example: SSH_PASS=123 SERVER_IP=1.1.1.1 ./scripts/deploy-production.sh"
  exit 1
fi

echo "🚀 Starting remote deployment to $IP..."

# 1. Update the code and trigger build
# We use a single SSH session to run the update commands
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$USER@$IP" << EOF
  echo "📂 Navigating to project directory..."
  cd "$DIR"
  
  echo "🌿 Pulling latest changes from main..."
  git pull origin main
  
  echo "🛠 Checking environment variables..."
  # Ensure the new Gemini variables are at least mentioned in the remote .env
  if ! grep -q "GOOGLE_API_KEY" .env; then
    echo "⚠️  Warning: GOOGLE_API_KEY not found in production .env"
    echo "Please ensure you add it to your server's .env file."
  fi

  # Deployment trigger
  # If using Coolify, we usually trigger a build through its CLI or just let it auto-detect.
  # If using Docker directly (as per Option C in DEPLOY.md):
  if [ -f "docker-compose.yml" ]; then
    echo "🐳 Rebuilding Docker containers..."
    docker compose up -d --build
  else
    echo "📦 Building with pnpm and restarting PM2..."
    pnpm install --frozen-lockfile
    pnpm build
    pm2 restart nuncio || pm2 start npm --name "nuncio" -- start
  fi

  echo "✅ Remote update complete!"
EOF

echo "🎉 Deployment finished successfully."
