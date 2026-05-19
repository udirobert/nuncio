#!/bin/bash

# nuncio Production Deploy Script (Coolify/Vultr Version)
# Automates the update process on a remote Coolify server using sshpass.
# 
# Usage:
# 1. Ensure you have sshpass installed locally.
# 2. Run: SSH_PASS=your_password SERVER_IP=your_ip ./scripts/deploy-production.sh

set -e

# Configuration
USER=${SSH_USER:-"root"}
IP=${SERVER_IP}
PASS=${SSH_PASS}

# Validation
if [ -z "$IP" ] || [ -z "$PASS" ]; then
  echo "Error: SERVER_IP and SSH_PASS environment variables are required."
  exit 1
fi

echo "🚀 Triggering remote Coolify rebuild for nuncio..."

# Trigger Coolify deployment via Artisan Tinker
# This finds Application(1) and queues a forced rebuild.
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$USER@$IP" << 'EOF'
  docker exec coolify php artisan tinker --execute='
    $app = \App\Models\Application::find(1);
    $uuid = (string) new \Visus\Cuid2\Cuid2;
    $result = queue_application_deployment(
        application: $app,
        deployment_uuid: $uuid,
        force_rebuild: true,
        is_api: true,
        no_questions_asked: true
    );
    echo "✅ Deployment Queued: " . $uuid . PHP_EOL;
  '
EOF

echo "🎉 Deployment trigger sent successfully."
