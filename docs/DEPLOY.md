# Deployment Guide

Deploy nuncio to Vultr using Coolify for automated Git-based deployments with SSL.

---

## Option A: Vultr + Coolify (recommended)

The fastest path to a live URL with auto-deploy on push.

### 1. Create a Vultr compute instance

1. Sign up at [vultr.com](https://www.vultr.com/) (new accounts get $250 free credit)
2. Deploy a new server:
   - **Type:** Cloud Compute — Shared CPU
   - **Location:** Choose closest to your users (or San Francisco for the HeyGen hackathon)
   - **Image:** Marketplace → **Coolify**
   - **Plan:** Regular Performance, 2 GB RAM ($10/month) — minimum for building Next.js
   - **Additional:** Enable IPv4

3. Wait for the server to deploy (~60 seconds)
4. Note the server IP address

### 2. Access Coolify

1. Open `http://<YOUR_SERVER_IP>:8000` in your browser
2. Create your admin account
3. Complete the initial setup wizard

### 3. Connect your GitHub repository

1. In Coolify, go to **Projects → New Project → New Resource**
2. Select **Public Repository** (or connect your GitHub account for private repos)
3. Enter: `https://github.com/udirobert/nuncio`
4. Select branch: `main`

### 4. Configure the deployment

1. **Build Pack:** Dockerfile
2. **Dockerfile Location:** `/Dockerfile`
3. **Port:** 3000

### 5. Set environment variables

In Coolify's environment variables section, add:

```env
# TinyFish — profile enrichment
TINYFISH_API_KEY=

# Anthropic — script generation
ANTHROPIC_API_KEY=

# HeyGen — video rendering
HEYGEN_API_KEY=
HEYGEN_AVATAR_ID=
HEYGEN_VOICE_ID=

# Melius — creative canvas MCP
MELIUS_API_KEY=

# Speechmatics — speech-to-text
SPEECHMATICS_API_KEY=

# App
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 6. Set up a custom domain (optional)

1. In Coolify, go to your resource → **Settings → Domains**
2. Add your domain (e.g., `nuncio.app`)
3. Point your domain's DNS A record to the Vultr server IP
4. Coolify will auto-provision an SSL certificate via Let's Encrypt

### 7. Deploy

Click **Deploy** in Coolify. It will:
- Pull the repo
- Build the Docker image
- Start the container
- Provision SSL

First deploy takes ~3-5 minutes. Subsequent deploys are faster due to Docker layer caching.

### 8. Enable auto-deploy

In Coolify, enable **Webhooks** for your resource. Add the webhook URL to your GitHub repo:
- Go to GitHub → Settings → Webhooks → Add webhook
- Paste the Coolify webhook URL
- Select "Just the push event"

Now every push to `main` triggers an automatic deployment.

---

## Option B: Direct VPS deployment (without Coolify)

If you prefer manual control:

### 1. Provision a Vultr compute instance

- **OS:** Ubuntu 22.04 LTS
- **Plan:** 2 GB RAM minimum

### 2. SSH into the server

```bash
ssh root@<YOUR_SERVER_IP>
```

### 3. Install dependencies

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install pnpm
corepack enable && corepack prepare pnpm@latest --activate

# Install PM2 for process management
npm install -g pm2

# Install Caddy for reverse proxy + auto-SSL
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install caddy
```

### 4. Clone and build

```bash
cd /opt
git clone https://github.com/udirobert/nuncio.git
cd nuncio
cp .env.example .env.local
# Edit .env.local with your API keys
nano .env.local

pnpm install
pnpm build
```

### 5. Start with PM2

```bash
pm2 start npm --name "nuncio" -- start
pm2 save
pm2 startup
```

### 6. Configure Caddy (reverse proxy + SSL)

```bash
cat > /etc/caddy/Caddyfile << 'EOF'
your-domain.com {
    reverse_proxy localhost:3000
}
EOF

systemctl restart caddy
```

Caddy automatically provisions and renews SSL certificates.

### 7. Set up auto-deploy (optional)

Create a deploy script:

```bash
cat > /opt/nuncio/deploy.sh << 'EOF'
#!/bin/bash
cd /opt/nuncio
git pull origin main
pnpm install --frozen-lockfile
pnpm build
pm2 restart nuncio
EOF

chmod +x /opt/nuncio/deploy.sh
```

Add a GitHub webhook that calls this script, or use a simple cron-based pull.

---

## Option C: Docker deployment (any provider)

Works on Vultr, DigitalOcean, AWS, or any Docker host.

```bash
# Build
docker build -t nuncio \
  --build-arg NEXT_PUBLIC_APP_URL=https://your-domain.com \
  .

# Run
docker run -d \
  --name nuncio \
  -p 3000:3000 \
  --env-file .env.local \
  --restart unless-stopped \
  nuncio
```

Put Caddy or nginx in front for SSL termination.

---

## Verifying the deployment

Once deployed, verify:

1. **Homepage loads:** `https://your-domain.com`
2. **Demo mode works:** `https://your-domain.com?demo=true`
3. **API routes respond:** `curl -X POST https://your-domain.com/api/enrich -H "Content-Type: application/json" -d '{"urls":["https://linkedin.com/in/test"]}'`

---

## Vultr Award eligibility

For the Milan AI Week hackathon Vultr track:
- Deploy on Vultr ✓
- Document the deployment (this file) ✓
- Include Vultr in the tech stack slide of your pitch deck
