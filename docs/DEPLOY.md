# Deployment Guide

Deploy nuncio to Vultr using Coolify for automated Git-based deployments with SSL.

---

## Security

### Environment variables

All environment variables containing secrets (`API_KEY`, `TOKEN`, `SECRET`) must stay out of version control.
This is enforced by `.gitignore` (covers `.env` and `.env.*`) and a pre-commit hook at
`scripts/check-secrets.sh` that blocks commits containing API key patterns.

Secrets are provisioned via Coolify's dashboard (Option A) or a server-side `.env.local` (Option B).
Never commit `.env.local` or push secrets to your repository.

### API key hygiene

- Each API key used by nuncio (TinyFish, Anthropic, Featherless, HeyGen, Speechmatics, Turso)
  grants access to a paid service. Treat them as credentials, not configuration.
- Rotate keys if they are ever exposed in logs, error messages, or commit history.
- The `NEXT_PUBLIC_*` prefix in Next.js exposes variables to the browser. Only use it for values
  that are safe to share (app URL, PostHog host). API keys are **never** prefixed with `NEXT_PUBLIC_`.

### Rate limiting

API routes implement per-IP sliding-window rate limits (`src/lib/rate-limit.ts`). Limits are conservative:
- Enrichment: 10 req/min
- Script generation: 10 req/min
- Video render: 3 req/min
- Translation: 5 req/min
- Transcription: 10 req/min

These prevent credit exhaustion from runaway requests or basic abuse. They are not a substitute
for a Web Application Firewall (WAF) in a production deployment.

### Firewall

Restrict inbound access to only the ports you need:

| Port | Purpose | Restrict to |
|------|---------|-------------|
| 22   | SSH     | Your IP only |
| 80   | HTTP    | Any (redirects to HTTPS) |
| 443  | HTTPS   | Any |
| 8000 | Coolify admin | Your IP only (or disable after setup) |

Example UFW rules:

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow from YOUR_IP to any port 22 proto tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow from YOUR_IP to any port 8000 proto tcp  # Coolify admin
ufw enable
```

### Data storage

- `NUNCIO_DATA_DIR` (default: `/.data`) holds share records when Turso is not configured.
  This directory is ephemeral in Docker — restarting the container loses file-based records.
  For production, configure Turso (`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`).
- Grove proof publishing is disabled by default (`GROVE_ENABLED=false`). Enable only if you
  need on-chain proof bundles.

### Monitoring

Consider adding basic health monitoring:
- **PostHog** is already configured for product analytics (not infrastructure monitoring).
- For production uptime, add an external health check against `https://your-domain.com/`
  (returns 200) and `https://your-domain.com/api/enrich` with an invalid payload (returns 400).

---

## Option A: Vultr + Coolify (recommended)

The fastest path to a live URL with auto-deploy on push. Coolify handles Docker builds, SSL
provisioning, and reverse proxying automatically.

### 1. Create a Vultr compute instance

1. Sign up at [vultr.com](https://www.vultr.com/) (new accounts get $250 free credit)
2. Deploy a new server:
   - **Type:** Cloud Compute — Shared CPU
   - **Location:** Choose closest to your users
   - **Image:** Marketplace → **Coolify**
   - **Plan:** Regular Performance, 2 GB RAM ($10/month) — minimum for building Next.js
   - **Additional:** Enable IPv4

3. Wait for the server to deploy (~60 seconds)
4. Note the server IP address
5. **Before proceeding, configure the firewall** (see [Security](#security) above) to restrict
   access to the Coolify admin port (8000) and SSH (22).

### 2. Access Coolify

1. Open `http://<YOUR_SERVER_IP>:8000` in your browser
2. Create your admin account with a strong, unique password
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

In Coolify's environment variables section, add the secrets your deployment needs.
**Do not use the `.env.example` file as a template with real values inside the repo** —
all secrets live only in Coolify's encrypted store:

```env
# TinyFish — profile enrichment
TINYFISH_API_KEY=

# Anthropic — script generation (optional if Featherless is set)
ANTHROPIC_API_KEY=

# Featherless — open-weight LLM fallback
FEATHERLESS_API_KEY=

# HeyGen — video rendering
HEYGEN_API_KEY=
HEYGEN_AVATAR_ID=
HEYGEN_VOICE_ID=

# Speechmatics — speech-to-text
SPEECHMATICS_API_KEY=

# App
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Storage — Turso for durable share records
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
```

### 6. Set up a custom domain

1. In Coolify, go to your resource → **Settings → Domains**
2. Add your domain (e.g., `nuncio.app`)
3. Point your domain's DNS A record to the Vultr server IP
4. Coolify auto-provisions an SSL certificate via Let's Encrypt and enforces HTTPS.

### 7. Deploy

Click **Deploy** in Coolify. It will:
- Pull the repo
- Build the Docker image
- Start the container as a non-root user
- Provision SSL
- Enforce HTTPS redirect

First deploy takes ~3-5 minutes. Subsequent deploys are faster due to Docker layer caching.

### 8. Enable auto-deploy

In Coolify, enable **Webhooks** for your resource. Add the webhook URL to your GitHub repo:
- Go to GitHub → Settings → Webhooks → Add webhook
- Paste the Coolify webhook URL
- Select "Just the push event"

Every push to `main` now triggers an automatic build and deploy.

---

## Option B: Direct VPS deployment (without Coolify)

For manual control. Assumes Ubuntu 22.04 LTS, 2 GB RAM minimum.

### 1. Provision a Vultr compute instance

- **OS:** Ubuntu 22.04 LTS
- **Plan:** 2 GB RAM minimum

### 2. Configure firewall before SSH

Run these from the Vultr web console or immediately after first SSH:

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow from YOUR_IP to any port 22 proto tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 3. Create a non-root user

```bash
adduser deploy
usermod -aG sudo deploy
# Disable root SSH login
sed -i 's/^PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd
```

Exit and reconnect as `deploy`:

```bash
ssh deploy@<YOUR_SERVER_IP>
```

### 4. Install dependencies

```bash
# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs

# Install pnpm
corepack enable && corepack prepare pnpm@latest --activate

# Install PM2 for process management
npm install -g pm2

# Install Caddy for reverse proxy + auto-SSL
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install caddy
```

### 5. Clone and build

```bash
cd /opt
sudo git clone https://github.com/udirobert/nuncio.git
sudo chown -R deploy:deploy nuncio
cd nuncio
cp .env.example .env.local
nano .env.local
# Add all API keys. See .env.example for the full list of variables.
# Protect the file: chmod 600 .env.local

pnpm install
pnpm build
```

### 6. Start with PM2

```bash
pm2 start npm --name "nuncio" -- start
pm2 save
pm2 startup
# Follow the printed command to enable PM2 on boot
```

### 7. Configure Caddy (reverse proxy + SSL)

```bash
cat > /tmp/Caddyfile << 'EOF'
your-domain.com {
    reverse_proxy localhost:3000
}
EOF
sudo mv /tmp/Caddyfile /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

Caddy automatically provisions and renews SSL certificates and enforces HTTPS.

### 8. Set up auto-deploy (optional)

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

Works on Vultr, DigitalOcean, AWS, or any Docker host. Requires a reverse proxy (Caddy/nginx)
in front for SSL termination.

```bash
# Build
docker build -t nuncio \
  --build-arg NEXT_PUBLIC_APP_URL=https://your-domain.com \
  .

# Run (do not expose port 3000 directly — use a reverse proxy)
docker run -d \
  --name nuncio \
  --network internal \
  --env-file .env.local \
  --restart unless-stopped \
  nuncio

# .env.local should have restricted permissions before this step
chmod 600 .env.local
```

**Do not expose port 3000 to the public internet.** The Docker host should run a reverse
proxy (Caddy, nginx, Traefik) on ports 80/443 that forwards to `localhost:3000` on the
internal Docker network. The reverse proxy handles SSL termination and HTTP-to-HTTPS redirect.

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
