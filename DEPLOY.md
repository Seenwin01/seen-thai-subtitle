# คู่มือนำขึ้นออนไลน์ (Deploy) — ให้ได้ลิงก์สาธารณะ

แอพนี้ต้องรันบนเครื่องที่มี **FFmpeg + Python(Whisper)** ดังนั้นต้อง deploy แบบ
container/VPS (ไม่ใช่ static host แบบ Vercel free) Dockerfile ในโปรเจกต์ครอบคลุมให้แล้ว

> หมายเหตุทรัพยากร: Whisper กินแรม/CPU พอควร แนะนำเริ่มที่ **2 vCPU / 4GB RAM** ขึ้นไป
> และตั้ง `WHISPER_MODEL=small` (หรือ `base` ถ้าเครื่องเล็ก)

---

## ตัวเลือกที่ 1 — Railway (ง่ายสุด, มี Docker auto)
1. push โค้ดขึ้น GitHub
2. railway.app → New Project → **Deploy from GitHub repo** → เลือก repo
3. Railway จะตรวจเจอ `Dockerfile` และ build ให้เอง
4. ตั้ง Variables: `WHISPER_MODEL=small` (และ `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` ถ้าจะเปิด AI จัดอันดับ/แปล)
5. ตั้ง Networking → **Generate Domain** → ได้ลิงก์ `https://<your-app>.up.railway.app`
6. (แนะนำ) เพิ่ม **Volume** mount ที่ `/app/storage` เพื่อให้งานไม่หายเวลารีดีพลอย

## ตัวเลือกที่ 2 — Render
1. push ขึ้น GitHub
2. render.com → New → **Web Service** → เชื่อม repo
3. Environment: **Docker** (ใช้ Dockerfile อัตโนมัติ)
4. Instance: อย่างน้อย **Standard (2GB+)**; เพิ่ม **Disk** mount `/app/storage`
5. ตั้ง Env vars เหมือนข้อ Railway → Deploy → ได้ลิงก์ `https://<app>.onrender.com`

## ตัวเลือกที่ 3 — VPS (DigitalOcean / Hetzner / AWS Lightsail) ด้วย Docker
```bash
# บนเซิร์ฟเวอร์ (Ubuntu)
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
git clone <your-repo> && cd klipr-thai-subtitle
docker compose up -d --build      # รันเบื้องหลัง
# แอพอยู่ที่พอร์ต 3000
```
ต่อโดเมน + HTTPS ด้วย Caddy (ง่ายสุด):
```bash
# /etc/caddy/Caddyfile
yourdomain.com {
    reverse_proxy localhost:3000
}
```
`sudo systemctl reload caddy` → ได้ `https://yourdomain.com` (Caddy ออก SSL ให้อัตโนมัติ)

---

## เช็คหลัง deploy
- เปิด `https://<โดเมน>/check` ให้ทุกบรรทัดที่ "จำเป็น" ขึ้นเขียว (ffmpeg, ffprobe, python, faster-whisper)
- ครั้งแรกที่ถอดเสียง โมเดล Whisper จะถูกดาวน์โหลด (ช้าหน่อยครั้งเดียว)

## หมายเหตุ Vercel / Netlify
ใช้ไม่ได้เต็มรูปแบบ เพราะ serverless รัน FFmpeg/Whisper ระยะยาวไม่ได้ (มี timeout/ไม่มี Python)
ถ้าจะใช้ Vercel ต้องแยก backend ประมวลผลไปไว้ที่ worker/VPS ต่างหาก
