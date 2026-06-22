# เริ่มใช้งาน + นำขึ้น Railway (คัดลอกรันได้เลย)

## A) push โค้ดขึ้น GitHub
```bash
cd klipr-thai-subtitle
git init
git add -A
git commit -m "Klipr Thai subtitle app (initial)"

# สร้าง repo เปล่าบน github.com ก่อน แล้วแทน <USER>/<REPO>
git branch -M main
git remote add origin https://github.com/<USER>/<REPO>.git
git push -u origin main
```
> มี `.gitignore` แล้ว — node_modules/.next/storage/.env จะไม่ถูก push

## B) Deploy บน Railway (ใช้ Dockerfile อัตโนมัติ)
1. ไป https://railway.app → **New Project** → **Deploy from GitHub repo** → เลือก repo
2. Railway อ่าน `railway.json` + `Dockerfile` แล้ว build เอง (มี healthcheck ที่ `/api/health`)
3. แท็บ **Variables** ใส่:
   - `WHISPER_MODEL=small`
   - (ถ้าจะเปิด AI จัดอันดับ/แปล) `ANTHROPIC_API_KEY=...` หรือ `OPENAI_API_KEY=...`
4. แท็บ **Settings → Networking → Generate Domain** → ได้ลิงก์ `https://<app>.up.railway.app`
5. (แนะนำ) **Settings → Volumes** → mount `/app/storage` กันงานหายตอนรีดีพลอย

## C) เช็คหลังขึ้น
- เปิด `https://<โดเมน>/check` ให้บรรทัด "จำเป็น" ขึ้นเขียวครบ
- ลองอัปโหลดคลิปสั้นๆ (ครั้งแรก Whisper จะโหลดโมเดล ~ช้าครั้งเดียว)
- บนมือถือ: เปิดลิงก์ → เมนูเบราว์เซอร์ → "เพิ่มลงหน้าจอโฮม" = ใช้เป็นแอป (PWA)

## ทางเลือกเร็วกว่า (CLI)
```bash
npm i -g @railway/cli
railway login
railway init
railway up           # build+deploy จากเครื่อง
railway domain        # ขอโดเมนสาธารณะ
```
