# Panduan Install & Setup — Telegram AI Generator Bot

## Daftar Isi

1. [Persyaratan](#1-persyaratan)
2. [Deploy di Coolify (Rekomendasi)](#2-deploy-di-coolify-rekomendasi)
3. [Deploy Manual dengan Docker Compose](#3-deploy-manual-dengan-docker-compose)
4. [Deploy Manual Tanpa Docker (VPS)](#4-deploy-manual-tanpa-docker-vps)
5. [Setup MongoDB Atlas](#5-setup-mongodb-atlas)
6. [Konfigurasi .env](#6-konfigurasi-env)
7. [Setup Domain & SSL](#7-setup-domain--ssl)
8. [Daftarkan Webhook ke Hubify](#8-daftarkan-webhook-ke-hubify)
9. [Perintah Sehari-hari](#9-perintah-sehari-hari)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Persyaratan

### Semua Metode Deploy

| Komponen | Keterangan |
|----------|------------|
| MongoDB Atlas | Database (gratis tier M0) — [cloud.mongodb.com](https://cloud.mongodb.com) |
| Freepik API Key | Untuk AI generation — [freepik.com/api](https://www.freepik.com/api) |
| Hubify API Key | Untuk QRIS payment — dashboard Hubify |
| Telegram Bot Token | Dari [@BotFather](https://t.me/BotFather) |
| Domain + SSL | Untuk menerima webhook Hubify |

### Untuk Coolify

| Komponen | Keterangan |
|----------|------------|
| Coolify Instance | Self-hosted di VPS (min 2GB RAM) — [coolify.io](https://coolify.io) |
| GitHub/GitLab repo | Kode bot di-push ke repo |

### Untuk Docker Compose / Manual

| Komponen | Minimum | Rekomendasi |
|----------|---------|-------------|
| OS | Ubuntu 22.04+ | Ubuntu 24.04 LTS |
| CPU | 1 vCore | 2 vCore |
| RAM | 1 GB | 2 GB |
| Storage | 20 GB | 40 GB |
| Docker | v24+ | v27+ |

---

## 2. Deploy di Coolify (Rekomendasi)

Coolify adalah self-hosted PaaS (alternatif Heroku/Vercel). Mendukung Docker Compose langsung dari Git repo.

### 2a. Pastikan Coolify Sudah Terinstall

Jika belum punya Coolify:

```bash
# Di VPS baru (min 2GB RAM, Ubuntu 22.04+)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Buka Coolify dashboard di `http://IP_VPS:8000`, buat akun admin.

### 2b. Hubungkan GitHub/GitLab

1. Di Coolify dashboard → **Sources** → tambahkan GitHub/GitLab
2. Authorize akses ke repo bot kamu

### 2c. Buat Project & Resource Baru

1. **Projects** → **New Project** → beri nama "AI Bot"
2. Di dalam project → **+ New** → pilih **Docker Compose**
3. Pilih repo GitHub kamu → branch `main`
4. Coolify akan otomatis mendeteksi `docker-compose.yml`

### 2d. Konfigurasi Environment Variables

Di halaman resource → tab **Environment Variables**, tambahkan semua variabel dari `.env.example`:

```env
BOT_TOKEN=1234567890:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ADMIN_ID=123456789
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/ai-bot?retryWrites=true&w=majority
FREEPIK_API_KEY=FPSX_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
HUBIFY_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxxxx
HUBIFY_WEBHOOK_SECRET=buat_string_acak_panjang_minimal_32_karakter
HUBIFY_BASE_URL=https://qris.hubify.store/api
WEBHOOK_PORT=3001
WEBHOOK_PUBLIC_URL=https://bot.domainmu.com
```

> **Catatan:** `REDIS_URL` tidak perlu diisi — sudah di-set otomatis di `docker-compose.yml` ke container Redis internal.

### 2e. Konfigurasi Domain (Proxy)

1. Di resource → tab **Settings** / **Proxy**
2. Service `bot` → set domain: `bot.domainmu.com`
3. Port: `3001`
4. Centang **Generate SSL** (Coolify pakai Let's Encrypt otomatis)

### 2f. Deploy

Klik **Deploy** → Coolify akan:
- Build Docker image dari `Dockerfile`
- Start 3 container: `bot`, `worker`, `redis`
- Setup reverse proxy + SSL otomatis

### 2g. Verifikasi

```bash
# Health check
curl https://bot.domainmu.com/health
# → {"status":"ok","timestamp":"..."}

# Test bot di Telegram
# Buka bot kamu → /start
```

### Auto Deploy

Coolify mendukung auto-deploy saat push ke GitHub. Aktifkan di:
- Resource → **Settings** → ✅ **Auto Deploy** → **Webhooks**

---

## 3. Deploy Manual dengan Docker Compose

Jika tidak pakai Coolify, bisa langsung dengan Docker Compose di VPS.

### 3a. Persiapan VPS

```bash
# Update sistem
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | bash

# Install Docker Compose plugin
apt install -y docker-compose-plugin

# Verifikasi
docker --version    # → Docker version 27.x.x
docker compose version  # → Docker Compose version v2.x.x
```

### 3b. Clone & Setup

```bash
cd /opt
git clone https://github.com/USERNAME/REPO_NAME.git ai-bot
cd ai-bot

# Buat .env dari template
cp .env.example .env
nano .env
# → Isi semua variabel (lihat Bagian 6)
```

### 3c. Jalankan

```bash
# Build dan start semua container
docker compose up -d --build

# Cek status
docker compose ps

# Lihat logs
docker compose logs -f

# Lihat log per service
docker compose logs -f bot
docker compose logs -f worker
```

### 3d. Update Deployment

```bash
cd /opt/ai-bot
git pull origin main
docker compose up -d --build
```

### 3e. Setup Reverse Proxy (Nginx)

Jika butuh domain + SSL di depan Docker:

```bash
apt install -y nginx certbot python3-certbot-nginx
```

Buat konfigurasi Nginx:

```bash
cat > /etc/nginx/sites-available/ai-bot << 'EOF'
server {
    listen 80;
    server_name bot.domainmu.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        client_max_body_size 10M;
    }
}
EOF

ln -sf /etc/nginx/sites-available/ai-bot /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# SSL otomatis
certbot --nginx -d bot.domainmu.com
```

---

## 4. Deploy Manual Tanpa Docker (VPS)

Metode tradisional tanpa Docker — install langsung di VPS.

### 4a. Install Node.js

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm alias default 20
```

### 4b. Install Redis

```bash
apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Test
redis-cli ping  # → PONG
```

Opsional — set password Redis:

```bash
sudo nano /etc/redis/redis.conf
# Cari dan ubah: requirepass PASSWORD_REDIS_KAMU
# Simpan, lalu:
sudo systemctl restart redis-server
```

Jika pakai password, format di `.env`:
```
REDIS_URL=redis://:PASSWORD_REDIS_KAMU@127.0.0.1:6379
```

### 4c. Clone & Install

```bash
cd /opt
git clone https://github.com/USERNAME/REPO_NAME.git ai-bot
cd ai-bot
npm ci --omit=dev
cp .env.example .env
nano .env
# → Isi semua variabel (lihat Bagian 6)
mkdir -p uploads temp logs
```

### 4d. Jalankan dengan PM2

```bash
npm install -g pm2

# Buat konfigurasi PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'ai-bot',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      env: { NODE_ENV: 'production' },
      error_file: './logs/bot-error.log',
      out_file: './logs/bot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'ai-worker',
      script: 'src/workers/index.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      env: { NODE_ENV: 'production' },
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
EOF

# Start
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 4e. Setup Nginx + SSL

Sama seperti langkah 3e di atas.

---

## 5. Setup MongoDB Atlas

### 5a. Buat Akun & Cluster

1. Buka [cloud.mongodb.com](https://cloud.mongodb.com) → daftar/login
2. **Create** → pilih **M0 Free** (gratis)
3. Region: **Singapore** (ap-southeast-1)
4. Nama cluster: `ai-bot-cluster`
5. Klik **Create Deployment**

### 5b. Buat Database User

1. **Database Access** → **Add New Database User**
2. Method: Password
3. Username: `botuser` → Auto-generate password → **copy sekarang**
4. Privileges: **Read and write to any database**
5. **Add User**

### 5c. Whitelist IP

1. **Network Access** → **Add IP Address**
2. Masukkan IP VPS (`curl ifconfig.me` dari VPS)
3. Atau klik **Allow Access from Anywhere** (0.0.0.0/0) jika IP dinamis

### 5d. Ambil Connection String

1. Clusters → **Connect** → **Drivers** → Node.js
2. Copy string, ganti `<password>` dan tambahkan nama DB:
   ```
   mongodb+srv://botuser:PASSWORD@ai-bot-cluster.xxxxx.mongodb.net/ai-bot?retryWrites=true&w=majority
   ```

---

## 6. Konfigurasi .env

Referensi semua environment variables:

```env
# ── Telegram ─────────────────────────────
BOT_TOKEN=1234567890:AAFxxxxxxxxxxxxx       # Dari @BotFather
ADMIN_ID=123456789                          # Telegram user ID admin

# ── MongoDB ──────────────────────────────
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/ai-bot?retryWrites=true&w=majority

# ── Redis ────────────────────────────────
REDIS_URL=redis://localhost:6379            # Untuk Docker: otomatis di-override

# ── Freepik API ──────────────────────────
FREEPIK_API_KEY=FPSX_xxxxxxxxxxxxxxxxxxxxxxx

# ── Hubify QRIS ─────────────────────────
HUBIFY_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxxxx
HUBIFY_WEBHOOK_SECRET=string_acak_32_karakter_minimal
HUBIFY_BASE_URL=https://qris.hubify.store/api

# ── Webhook ──────────────────────────────
WEBHOOK_PORT=3001
WEBHOOK_PUBLIC_URL=https://bot.domainmu.com

# ── Opsional ─────────────────────────────
UPLOAD_DIR=./uploads
TEMP_DIR=./temp
MAX_ACTIVE_JOBS_PER_USER=3
```

> **Penting:** Jangan commit file `.env` ke Git! Sudah ada di `.gitignore`.

---

## 7. Setup Domain & SSL

### Jika deploy via Coolify

SSL otomatis — cukup set domain di Coolify dashboard (lihat langkah 2e).

### Jika deploy via Docker Compose / Manual

1. Arahkan domain ke IP VPS (A record di DNS):
   ```
   bot.domainmu.com  →  IP_VPS
   ```
2. Setup Nginx reverse proxy + Certbot (lihat langkah 3e)
3. Verifikasi:
   ```bash
   curl https://bot.domainmu.com/health
   ```

---

## 8. Daftarkan Webhook ke Hubify

Setelah domain + SSL aktif:

1. Login dashboard Hubify → **Settings → Webhooks**
2. Tambahkan endpoint:
   ```
   https://bot.domainmu.com/webhook/hubify
   ```
3. Copy **Webhook Secret** → isi ke `HUBIFY_WEBHOOK_SECRET` di env
4. Restart bot:
   ```bash
   # Coolify: klik Re-deploy di dashboard
   # Docker: docker compose restart bot
   # PM2: pm2 restart ai-bot
   ```

---

## 9. Perintah Sehari-hari

### Docker Compose

```bash
cd /opt/ai-bot

docker compose ps                    # Status container
docker compose logs -f               # Log semua service
docker compose logs -f bot           # Log bot saja
docker compose logs -f worker        # Log worker saja
docker compose restart               # Restart semua
docker compose down                  # Stop semua
docker compose up -d --build         # Rebuild + start
```

### PM2 (tanpa Docker)

```bash
pm2 status                           # Status proses
pm2 logs                             # Log realtime
pm2 logs ai-bot --lines 100         # Log bot
pm2 logs ai-worker --lines 100      # Log worker
pm2 restart all                      # Restart semua
pm2 monit                            # Monitor CPU/RAM
```

### Update Deployment

```bash
# Docker Compose
cd /opt/ai-bot && git pull && docker compose up -d --build

# PM2
cd /opt/ai-bot && git pull && npm ci --omit=dev && pm2 restart all

# Coolify: otomatis jika auto-deploy aktif, atau klik Re-deploy
```

### Cleanup File Lama

```bash
# Docker — masuk ke container
docker compose exec bot sh -c 'find /app/uploads -type f -mtime +1 -delete'

# PM2 / manual
find /opt/ai-bot/uploads -type f -mtime +1 -delete

# Auto-cleanup via cron (setiap hari jam 3 pagi)
# crontab -e → tambahkan:
# 0 3 * * * find /opt/ai-bot/uploads -type f -mtime +1 -delete
```

---

## 10. Troubleshooting

### Bot tidak merespons

```bash
# Docker
docker compose ps                     # Semua container harus "Up"
docker compose logs bot --tail 50     # Cek error

# PM2
pm2 status                            # Harus "online"
pm2 logs ai-bot --err --lines 50

# Test token
curl https://api.telegram.org/botTOKEN_KAMU/getMe
```

### Redis gagal

```bash
# Docker — Redis health check
docker compose ps    # redis harus "healthy"
docker compose exec redis redis-cli ping  # → PONG

# PM2 / manual
systemctl status redis-server
redis-cli ping
```

### MongoDB gagal konek

```bash
# Cek connection string
grep MONGODB .env

# Cek IP whitelist di MongoDB Atlas → Network Access
# Pastikan IP VPS terdaftar (atau 0.0.0.0/0)
```

### Webhook tidak diterima

```bash
# Test endpoint
curl -X POST https://bot.domainmu.com/webhook/hubify \
  -H "Content-Type: application/json" \
  -d '{"test":true}'

# Docker: cek port forwarding
docker compose ps   # Port 3001 harus ter-forward

# Cek Nginx
nginx -t && tail -20 /var/log/nginx/error.log
```

### Worker tidak memproses job

```bash
# Docker
docker compose logs worker --tail 50

# Cek Redis queue
docker compose exec redis redis-cli KEYS "bull:*"

# PM2
pm2 logs ai-worker --lines 50
```

---

## Struktur File

```
project/
├── .env.example            ← Template environment variables
├── .env                    ← Config aktual (JANGAN commit!)
├── .dockerignore           ← Exclude file dari Docker build
├── .gitignore
├── Dockerfile              ← Docker image definition
├── docker-compose.yml      ← Multi-container setup
├── package.json
├── src/
│   ├── index.js            ← Entry point bot
│   ├── bot/                ← Telegram bot handlers & menus
│   ├── config/             ← Configuration
│   ├── models/             ← Mongoose models
│   ├── services/           ← Freepik API, Hubify, webhook server
│   ├── utils/              ← Redis, file helper, user helper
│   └── workers/            ← BullMQ job processors
├── uploads/                ← Hasil generate (auto-cleanup)
└── temp/                   ← File temporary
```

---

## Checklist Sebelum Go-Live

- [ ] MongoDB Atlas cluster aktif + IP di-whitelist
- [ ] Semua API key valid (BOT_TOKEN, FREEPIK, HUBIFY)
- [ ] `.env` terisi lengkap
- [ ] Container/proses berjalan (bot + worker + redis)
- [ ] `https://bot.domainmu.com/health` → `{"status":"ok"}`
- [ ] Webhook Hubify terdaftar + secret sudah di-set
- [ ] Test `/start` di Telegram — bot merespons
- [ ] Test generate gambar — hasilnya dikirim ke chat
- [ ] Test upgrade plan — QR QRIS muncul
