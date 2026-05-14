# Deploying nuncio to Vultr

This guide covers deploying nuncio to a Vultr cloud server for the Milan AI Week / AI Agent Olympics submission (Vultr Award track).

---

## Prerequisites

- A [Vultr account](https://www.vultr.com/) ($200 credits available via the hackathon promo)
- The nuncio repo cloned locally
- All API keys ready (see `.env.example`)

---

## 1. Provision a server

**Recommended:** Vultr Cloud Compute — Shared CPU

| Setting | Value |
|---|---|
| OS | Ubuntu 24.04 LTS |
| Plan | 1 vCPU / 1 GB / 25 GB SSD ($6/mo) — sufficient for demo |
| Region | Choose closest to your audience (e.g. Amsterdam for Milan) |
| Additional features | ✅ Enable IPv6 |

After creation, note the **IP address** and **root password** from the Vultr dashboard.

---

## 2. SSH into the server

```bash
ssh root@<YOUR_SERVER_IP>
```

---

## 3. Install dependencies

```bash
# System packages
apt update && apt upgrade -y
apt install -y git curl

# Node.js 22 (LTS)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# pnpm
npm install -g pnpm

# Verify
node -v   # v22.x
pnpm -v   # 10.x
```

---

## 4. Clone and build

```bash
cd /opt
git clone https://github.com/<your-org>/nuncio.git
cd nuncio

# Install dependencies
pnpm install

# Create env file
cp .env.example .env.local
```

---

## 5. Configure environment variables

```bash
nano .env.local
```

Fill in all values:

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
NEXT_PUBLIC_APP_URL=http://<YOUR_SERVER_IP>:3000
```

---

## 6. Build the application

```bash
pnpm build
```

If the build succeeds, proceed. If it fails, check that all env vars are set — Next.js validates them at build time for any that are used in server components.

---

## 7. Run with PM2 (production process manager)

```bash
npm install -g pm2

# Start the app
pm2 start pnpm --name "nuncio" -- start

# Verify it's running
pm2 status
curl http://localhost:3000

# Save the process list (auto-restart on reboot)
pm2 save
pm2 startup
```

The app is now live at `http://<YOUR_SERVER_IP>:3000`.

---

## 8. (Optional) Add a domain and HTTPS

If you have a domain pointing to the server:

```bash
# Install Caddy — automatic HTTPS via Let's Encrypt
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install caddy
```

Edit the Caddyfile:

```bash
nano /etc/caddy/Caddyfile
```

Replace with:

```
your-domain.com {
    reverse_proxy localhost:3000
}
```

```bash
systemctl restart caddy
```

Caddy will automatically provision an SSL certificate. The app is now live at `https://your-domain.com`.

Update `NEXT_PUBLIC_APP_URL` in `.env.local` and rebuild:

```bash
cd /opt/nuncio
# Update NEXT_PUBLIC_APP_URL to https://your-domain.com
pnpm build
pm2 restart nuncio
```

---

## 9. Verify deployment

```bash
# Health check
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Should return 200

# Demo mode check
curl -s "http://localhost:3000?demo=true" | head -20
# Should return HTML

# Check logs
pm2 logs nuncio --lines 50
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Build fails with "ANTHROPIC_API_KEY is not configured" | Ensure `.env.local` exists and all keys are set before `pnpm build` |
| App starts but enrichment fails | Check that `TINYFISH_API_KEY` is valid — `curl -X POST https://api.fetch.tinyfish.ai -H "X-API-Key: $TINYFISH_API_KEY" -H "Content-Type: application/json" -d '{"urls":["https://example.com"]}'` |
| HeyGen returns 401 | Verify `HEYGEN_API_KEY` is correct and the account has credits |
| HeyGen returns 400 on video creation | Verify `HEYGEN_AVATAR_ID` and `HEYGEN_VOICE_ID` match your account's avatars/voices |
| Port 3000 not accessible | Check Vultr firewall settings — add a TCP rule for port 3000 in the Vultr dashboard |
| PM2 process crashes | `pm2 logs nuncio --err` for error details |

---

## Quick deploy script

For a fresh server, you can paste this entire block:

```bash
#!/bin/bash
set -e

apt update && apt upgrade -y
apt install -y git curl

curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm install -g pnpm pm2

cd /opt
git clone https://github.com/<your-org>/nuncio.git
cd nuncio
pnpm install

# You must still manually create .env.local with your keys
echo "⚠️  Don't forget to create .env.local with your API keys before building!"

# Once .env.local is ready:
# pnpm build
# pm2 start pnpm --name "nuncio" -- start
# pm2 save && pm2 startup
```

---

## Costs

| Resource | Vultr pricing |
|---|---|
| 1 vCPU / 1 GB server | $6/month |
| Bandwidth | Included (1 TB) |
| **Total for hackathon** | **~$0.20/day** |

With the $200 Vultr credit, this runs for free for months.