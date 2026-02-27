# Panduan Install & Setup — Telegram AI Generator Bot

## Daftar Isi

1. [Persyaratan VPS](#1-persyaratan-vps)
2. [Persiapan Server](#2-persiapan-server)
3. [Install Node.js](#3-install-nodejs)
4. [Install Redis](#4-install-redis)
5. [Setup MongoDB Atlas](#5-setup-mongodb-atlas)
6. [Deploy Kode Bot](#6-deploy-kode-bot)
7. [Konfigurasi .env](#7-konfigurasi-env)
8. [Jalankan dengan PM2](#8-jalankan-dengan-pm2)
9. [Setup Nginx + SSL (Webhook)](#9-setup-nginx--ssl-webhook)
10. [Daftarkan Webhook ke Hubify](#10-daftarkan-webhook-ke-hubify)
11. [Perintah Sehari-hari](#11-perintah-sehari-hari)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Persyaratan VPS

| Komponen | Minimum | Rekomendasi |
|----------|---------|-------------|
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| CPU | 1 vCore | 2 vCore |
| RAM | 1 GB | 2 GB |
| Storage | 20 GB | 40 GB |
| Node.js | v18 LTS | v20 LTS |
| Akses | Root / sudo | Root / sudo |

> **IP Publik atau Domain diperlukan** jika ingin menerima webhook dari Hubify.

---

## 2. Persiapan Server

Login ke VPS via SSH:

```bash
ssh root@IP_VPS_KAMU
```

Update sistem dan install dependensi dasar:

```bash
apt update && apt upgrade -y
apt install -y curl git build-essential ufw nginx certbot python3-certbot-nginx
```

Konfigurasi firewall dasar:

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

Buat user non-root untuk menjalankan bot (opsional tapi direkomendasikan):

```bash
adduser botuser
usermod -aG sudo botuser
su - botuser
```

---

## 3. Install Node.js

Gunakan NVM (Node Version Manager) agar mudah upgrade:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Reload shell
source ~/.bashrc

# Install Node.js 20 LTS
nvm install 20
nvm use 20
nvm alias default 20

# Verifikasi
node -v   # → v20.x.x
npm -v    # → 10.x.x
```

---

## 4. Install Redis

```bash
# Install Redis dari repo resmi Ubuntu
sudo apt install -y redis-server

# Edit konfigurasi Redis
sudo nano /etc/redis/redis.conf
```

Cari dan ubah baris-baris berikut di `redis.conf`:

```
# Bind hanya ke localhost (lebih aman)
bind 127.0.0.1 -::1

# Aktifkan password (opsional tapi disarankan)
requirepass PASSWORD_REDIS_KAMU

# Aktifkan persistence (supaya data tidak hilang jika restart)
appendonly yes
appendfilename "appendonly.aof"
```

Simpan file (`Ctrl+O`, `Enter`, `Ctrl+X`), lalu:

```bash
# Restart dan aktifkan Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Cek status
sudo systemctl status redis-server

# Test koneksi (jika pakai password)
redis-cli -a PASSWORD_REDIS_KAMU ping
# → PONG
```

Jika Redis pakai password, format URL di `.env`:
```
REDIS_URL=redis://:PASSWORD_REDIS_KAMU@127.0.0.1:6379
```

---

## 5. Setup MongoDB Atlas

### 5a. Buat Akun & Cluster

1. Buka [https://cloud.mongodb.com](https://cloud.mongodb.com) dan daftar/login
2. Klik **"Create"** → pilih **"M0 Free"** (gratis, cukup untuk bot ini)
3. Pilih **Cloud Provider**: AWS / Google Cloud / Azure (pilih yang region-nya paling dekat)
4. Pilih **Region**: Singapore (ap-southeast-1) untuk Indonesia
5. Beri nama cluster, misal: `ai-bot-cluster`
6. Klik **"Create Deployment"**

### 5b. Buat Database User

1. Di sidebar kiri klik **"Database Access"**
2. Klik **"Add New Database User"**
3. Pilih **Authentication Method**: Password
4. Isi **Username**: `botuser`
5. Klik **"Autogenerate Secure Password"** → **COPY password-nya sekarang**
6. Di **Database User Privileges** pilih **"Read and write to any database"**
7. Klik **"Add User"**

### 5c. Whitelist IP VPS

1. Di sidebar klik **"Network Access"**
2. Klik **"Add IP Address"**
3. Masukkan IP publik VPS kamu (cek dengan `curl ifconfig.me` dari VPS)
4. Beri deskripsi: `VPS Bot`
5. Klik **"Confirm"**

> Atau klik **"Allow Access from Anywhere"** (0.0.0.0/0) jika IP VPS bisa berubah. Kurang aman, tapi lebih praktis.

### 5d. Ambil Connection String

1. Di halaman Clusters, klik tombol **"Connect"** di samping cluster kamu
2. Pilih **"Drivers"**
3. Pilih **Driver**: Node.js, **Version**: 5.5 or later
4. Copy connection string, bentuknya:
   ```
   mongodb+srv://botuser:<password>@ai-bot-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Ganti `<password>` dengan password yang tadi di-copy
6. Tambahkan nama database sebelum `?`:
   ```
   mongodb+srv://botuser:PASSWORD@ai-bot-cluster.xxxxx.mongodb.net/ai-bot?retryWrites=true&w=majority&appName=ai-bot-cluster
   ```

Simpan string ini — akan diisi ke `MONGODB_URI` di `.env`.

---

## 6. Deploy Kode Bot

### Cara A — Upload via Git (Rekomendasi)

Jika kode ada di GitHub/GitLab:

```bash
cd ~
git clone https://github.com/USERNAME/REPO_NAME.git bot
cd bot
npm install --production
```

### Cara B — Upload Manual via SCP

Dari komputer lokal kamu:

```bash
# Zip folder project (tanpa node_modules)
zip -r bot.zip . -x "node_modules/*" -x ".git/*"

# Upload ke VPS
scp bot.zip root@IP_VPS_KAMU:/home/botuser/

# Di VPS, ekstrak
ssh root@IP_VPS_KAMU
su - botuser
cd ~
unzip bot.zip -d bot
cd bot
npm install --production
```

### Buat folder yang diperlukan

```bash
cd ~/bot
mkdir -p uploads temp
```

---

## 7. Konfigurasi .env

```bash
cd ~/bot
cp .env.example .env
nano .env
```

Isi semua variabel:

```env
# ── Telegram ──────────────────────────────────────────
# Buat bot di @BotFather → /newbot → copy token
BOT_TOKEN=1234567890:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Cari user ID kamu di @userinfobot atau @getidsbot
ADMIN_ID=123456789

# ── MongoDB Atlas ──────────────────────────────────────
# Connection string dari langkah 5d (ganti password!)
MONGODB_URI=mongodb+srv://botuser:PASSWORDKAMU@ai-bot-cluster.xxxxx.mongodb.net/ai-bot?retryWrites=true&w=majority

# ── Redis ──────────────────────────────────────────────
# Jika Redis pakai password:
REDIS_URL=redis://:PASSWORD_REDIS_KAMU@127.0.0.1:6379
# Jika tanpa password:
# REDIS_URL=redis://127.0.0.1:6379

# ── Freepik API ────────────────────────────────────────
# Daftar di freepik.com/api → buat API key
FREEPIK_API_KEY=FPSX_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ── Hubify QRIS ────────────────────────────────────────
HUBIFY_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxxxx
# Buat secret acak untuk verifikasi webhook
HUBIFY_WEBHOOK_SECRET=buat_string_acak_panjang_minimal_32_karakter
HUBIFY_BASE_URL=https://qris.hubify.store/api

# ── Webhook Server ─────────────────────────────────────
WEBHOOK_PORT=3001
# Domain atau subdomain yang sudah diarahkan ke VPS ini
WEBHOOK_PUBLIC_URL=https://bot.domainmu.com

# ── Storage ────────────────────────────────────────────
UPLOAD_DIR=./uploads
TEMP_DIR=./temp

# ── BullMQ ─────────────────────────────────────────────
MAX_ACTIVE_JOBS_PER_USER=3
```

Simpan (`Ctrl+O`, `Enter`, `Ctrl+X`), lalu amankan file:

```bash
chmod 600 .env
```

---

## 8. Jalankan dengan PM2

PM2 adalah process manager untuk Node.js — bot akan otomatis restart jika crash dan berjalan di background.

### Install PM2

```bash
npm install -g pm2
```

### Buat konfigurasi PM2

```bash
cd ~/bot
nano ecosystem.config.js
```

Isi dengan:

```js
module.exports = {
  apps: [
    {
      name: 'ai-bot',
      script: 'src/index.js',
      cwd: '/home/botuser/bot',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/bot-error.log',
      out_file: './logs/bot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'ai-worker',
      script: 'src/workers/index.js',
      cwd: '/home/botuser/bot',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
```

Simpan, lalu buat folder logs:

```bash
mkdir -p ~/bot/logs
```

### Jalankan bot dan worker

```bash
cd ~/bot
pm2 start ecosystem.config.js

# Lihat status
pm2 status

# Lihat log realtime
pm2 logs

# Lihat log per proses
pm2 logs ai-bot
pm2 logs ai-worker
```

### Aktifkan auto-start setelah reboot VPS

```bash
pm2 startup
# PM2 akan print perintah → copy dan jalankan perintahnya, contoh:
# sudo env PATH=$PATH:/home/botuser/.nvm/versions/node/v20.x.x/bin pm2 startup systemd -u botuser --hp /home/botuser

pm2 save
```

---

## 9. Setup Nginx + SSL (Webhook)

Webhook Hubify membutuhkan endpoint HTTPS publik. Nginx sebagai reverse proxy ke port 3001.

### 9a. Konfigurasi DNS

Di panel domain kamu, buat A record:
```
bot.domainmu.com  →  IP_VPS_KAMU
```

Tunggu propagasi DNS (biasanya 1–5 menit di Cloudflare, bisa lebih lama di provider lain).

### 9b. Konfigurasi Nginx

```bash
sudo nano /etc/nginx/sites-available/ai-bot
```

Isi:

```nginx
server {
    listen 80;
    server_name bot.domainmu.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
        client_max_body_size 10M;
    }
}
```

Aktifkan konfigurasi:

```bash
sudo ln -s /etc/nginx/sites-available/ai-bot /etc/nginx/sites-enabled/
sudo nginx -t          # Test konfigurasi
sudo systemctl reload nginx
```

### 9c. Install SSL Certificate (Let's Encrypt)

```bash
sudo certbot --nginx -d bot.domainmu.com
```

Ikuti instruksi:
- Masukkan email
- Setujui Terms of Service (A)
- Pilih apakah mau share email (N)
- Certbot otomatis update konfigurasi Nginx ke HTTPS

Cek SSL auto-renewal:

```bash
sudo certbot renew --dry-run
```

### 9d. Verifikasi

```bash
curl https://bot.domainmu.com/health
# → {"status":"ok","timestamp":"2024-..."}
```

---

## 10. Daftarkan Webhook ke Hubify

Setelah SSL aktif, daftarkan URL webhook di dashboard Hubify:

1. Login ke dashboard Hubify
2. Masuk ke **Settings → Webhooks**
3. Tambahkan endpoint:
   ```
   https://bot.domainmu.com/webhook/hubify
   ```
4. Copy **Webhook Secret** yang diberikan Hubify
5. Update `.env`:
   ```env
   HUBIFY_WEBHOOK_SECRET=secret_dari_hubify
   ```
6. Restart bot:
   ```bash
   pm2 restart ai-bot
   ```

Untuk **MacroDroid** (notifikasi HP Android):
- Endpoint: `https://bot.domainmu.com/webhook-notification`
- Method: `POST`
- Body JSON:
  ```json
  {"message": "Pembayaran Rp 29.127 dari NAMA berhasil", "source": "gopay"}
  ```

---

## 11. Perintah Sehari-hari

### Monitor

```bash
# Status semua proses
pm2 status

# Log realtime
pm2 logs

# Log bot saja
pm2 logs ai-bot --lines 100

# Log worker saja
pm2 logs ai-worker --lines 100

# Monitor CPU/RAM
pm2 monit
```

### Deploy Update

```bash
cd ~/bot

# Jika pakai Git
git pull origin main

# Install dependensi baru (jika ada perubahan package.json)
npm install --production

# Restart semua
pm2 restart all

# Atau restart per proses
pm2 restart ai-bot
pm2 restart ai-worker
```

### Kelola Bot

```bash
# Stop semua
pm2 stop all

# Start semua
pm2 start all

# Reload tanpa downtime (zero-downtime restart)
pm2 reload all

# Hapus dari PM2
pm2 delete all
```

### Redis

```bash
# Masuk ke Redis CLI
redis-cli -a PASSWORD_REDIS_KAMU

# Cek jumlah session aktif
KEYS tgbot:sess:*

# Cek active jobs counter user tertentu
GET active_jobs:USER_ID

# Flush semua session (hati-hati!)
# DEL $(redis-cli KEYS "tgbot:sess:*")

# Keluar
exit
```

### Disk — bersihkan file hasil generate lama

```bash
# Lihat ukuran folder uploads
du -sh ~/bot/uploads/

# Hapus file lebih dari 1 hari
find ~/bot/uploads/ -type f -mtime +1 -delete

# Buat cron job otomatis (setiap hari jam 03:00)
crontab -e
# Tambahkan baris:
# 0 3 * * * find /home/botuser/bot/uploads/ -type f -mtime +1 -delete
```

---

## 12. Troubleshooting

### Bot tidak merespons

```bash
# Cek apakah proses berjalan
pm2 status

# Cek log error
pm2 logs ai-bot --err --lines 50

# Cek apakah token valid
curl https://api.telegram.org/botTOKEN_KAMU/getMe
```

### Redis gagal konek

```bash
# Cek status Redis
sudo systemctl status redis-server

# Test koneksi manual
redis-cli -a PASSWORD ping

# Cek log Redis
sudo journalctl -u redis-server -n 50
```

### MongoDB gagal konek

```bash
# Cek connection string di .env
cat ~/bot/.env | grep MONGODB

# Test koneksi dari VPS (butuh mongosh)
# npm install -g mongosh
mongosh "mongodb+srv://botuser:PASS@cluster.mongodb.net/ai-bot"

# Jika timeout → cek IP Whitelist di MongoDB Atlas
# Network Access → pastikan IP VPS terdaftar
```

### Webhook tidak diterima

```bash
# Test endpoint dari luar
curl -X POST https://bot.domainmu.com/webhook/hubify \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: test" \
  -d '{"test":true}'

# Cek Nginx error log
sudo tail -f /var/log/nginx/error.log

# Cek apakah port 3001 aktif
ss -tlnp | grep 3001
```

### Worker tidak memproses job

```bash
# Cek log worker
pm2 logs ai-worker --lines 100

# Pastikan Redis berjalan (BullMQ butuh Redis)
redis-cli ping

# Cek antrian di Redis
redis-cli -a PASS
KEYS bull:*
```

### Port 3001 sudah dipakai

```bash
# Cari proses yang pakai port 3001
sudo lsof -i :3001

# Ganti port di .env
WEBHOOK_PORT=3002
# Dan update konfigurasi Nginx ke port yang baru
pm2 restart ai-bot
sudo systemctl reload nginx
```

---

## Struktur File di VPS

```
/home/botuser/bot/
├── .env                    ← Konfigurasi (jangan commit ke Git!)
├── ecosystem.config.js     ← Konfigurasi PM2
├── package.json
├── src/
│   ├── index.js            ← Entry point bot
│   ├── workers/index.js    ← Entry point worker
│   └── ...
├── uploads/                ← File hasil generate (auto-cleanup)
├── temp/                   ← File temporary
└── logs/                   ← Log PM2
    ├── bot-out.log
    ├── bot-error.log
    ├── worker-out.log
    └── worker-error.log
```

---

## Checklist Sebelum Go-Live

- [ ] Node.js v18+ terinstall
- [ ] Redis berjalan dan bisa diakses
- [ ] MongoDB Atlas cluster aktif, IP VPS di-whitelist
- [ ] `.env` terisi lengkap, semua API key valid
- [ ] `pm2 status` menunjukkan `ai-bot` dan `ai-worker` **online**
- [ ] `https://bot.domainmu.com/health` mengembalikan `{"status":"ok"}`
- [ ] Webhook Hubify terdaftar dan secret sudah di-set di `.env`
- [ ] Test `/start` di Telegram — bot merespons
- [ ] Test generate gambar gratis — berhasil dikirim
- [ ] Test upgrade plan — QRIS QR muncul
