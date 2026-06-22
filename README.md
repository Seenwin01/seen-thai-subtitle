# ซับไทย AI — โคลน Klipr (AI Subtitle + AI Repurposing)

เว็บแอพครบวงจรสำหรับครีเอเตอร์ไทย คล้าย [kliprapp.com](https://kliprapp.com)
ครอบคลุมทั้งสองโปรดักต์ของ Klipr:

1. **AI ใส่ซับ (AI Subtitle)** — อัปโหลดวิดีโอ → AI ถอดเสียงไทย → เลือกสไตล์ซับ → เบิร์นซับลงคลิป → ดาวน์โหลด
2. **AI ตัดคลิปไวรัล (AI Repurposing)** — อัปโหลดวิดีโอยาว → AI หาช่วงที่น่าจะไวรัล → ตัดคลิป + รีเฟรมแนวตั้ง 9:16 ตามใบหน้า → ส่งเข้าหน้าใส่ซับต่อ

> โปรเจกต์นี้เป็นเดโมเพื่อการเรียนรู้ ไม่ได้สังกัด Klipr

## ฟีเจอร์

- ถอดเสียงภาษาไทยพร้อม timestamp ระดับคำ (faster-whisper, รันบนเครื่อง)
- นำเข้าวิดีโอจากไฟล์ หรือจาก **ลิงก์ YouTube** (yt-dlp)
- **AI ตัดคลิปไวรัล + จัดอันดับ** — ให้คะแนนช่วงที่น่าสนใจ แล้ว**จัดอันดับ**โอกาสไวรัล (ใช้ LLM ถ้าตั้ง API key ไม่งั้นใช้ระบบให้คะแนน heuristic)
- **รีเฟรมแนวตั้ง 9:16 ตามใบหน้า** (OpenCV) พร้อม fallback crop กลางภาพ
- 14+ เทมเพลตซับไวรัล + ปรับสี/ฟอนต์/ตำแหน่ง/ขนาดเอง
- **บันทึกเทมเพลตซับส่วนตัว** — เซฟสไตล์ที่ปรับเองไว้ใช้ซ้ำได้ทุกคลิป (เก็บใน localStorage)
- **ระบบสมาชิก/เครดิต + แผน** — Free / Viral Sub / Viral Talk (ราคาตาม Klipr) หักเครดิตตอน render, จำกัดความยาวต่อไฟล์, ติดลายน้ำเฉพาะแผนฟรี
- ไฮไลท์คำที่กำลังพูดแบบคาราโอเกะ + **แอนิเมชันคำเด้ง (pop)** ตอนพูดถึง
- **AI เน้นคำสำคัญอัตโนมัติ** — ไฮไลท์ keyword ในซับด้วยสีพิเศษ (heuristic ภาษาไทย: เลข/คำสำคัญ/คำยาว, เว้น stopword)
- **Auto-emoji** — เติม emoji ตามคีย์เวิร์ดในซับอัตโนมัติ (เงิน💰 ไฟ🔥 ไวรัล🚀 …)
- **แคปชั่น + แฮชแท็กอัตโนมัติ** — สร้างแคปชั่นโพสต์ + #แฮชแท็ก จากซับ (LLM ถ้ามี key ไม่งั้น heuristic)
- **ค้นหาในซับ** — ค้นคำในถอดเสียง แล้วคลิกกระโดดไปช่วงเวลานั้นในพรีวิว
- **นำเข้าไฟล์ .srt** — มีซับอยู่แล้วก็อัปมารีสไตล์/เบิร์นได้เลย ไม่ต้องถอดเสียงใหม่
- **ลบคำเติมอัตโนมัติ** — เอา เอ่อ/อืม/อ่า/uh ออกจากซับในคลิกเดียว
- พรีวิวสดบนหน้าเว็บก่อน render + **แก้ไขซับเต็มรูปแบบ** (แก้ข้อความ/เวลา, แบ่ง/รวม/ลบ segment)
- ส่งออกไฟล์ซับ **.srt / .ass** จากซับที่แก้แล้ว
- **อัตราส่วนหลายแบบ** — render เป็น 9:16 / 1:1 / 4:5 / 16:9 ตามแพลตฟอร์ม (fit + letterbox)
- **Export 4K + ซับโปร่งใส** — เลือกความละเอียด 1080p/2K/4K หรือส่งออกซับอย่างเดียวบนพื้นโปร่งใส (.mov overlay)
- **แปลซับ 15 ภาษา** (อังกฤษ/จีน/ญี่ปุ่น/เกาหลี/…) ผ่าน LLM คงเวลาเดิม (ต้องตั้ง API key)
- ส่งออกวิดีโอฝังซับ (MP4) และไฟล์ SRT
- **หน้า Dashboard งาน** (`/jobs`) — รวมงานทั้งหมด ดูสถานะ/progress เปิดแก้ต่อ ดาวน์โหลด หรือลบ
- **หน้าตรวจสอบระบบ** (`/check`) — เช็คว่าเครื่องมือที่จำเป็นพร้อมหรือยัง
- **งานเบื้องหลัง + แถบ progress + คิว** — async + poll สถานะ มี % เรียลไทม์, จำกัดงานพร้อมกัน (JOB_CONCURRENCY), ลบงานเก่าอัตโนมัติ (JOB_TTL_HOURS)
- **PWA** — ติดตั้งบนมือถือ/เปิดเต็มจอเหมือนแอป (manifest + service worker)
- **ชุดเทสต์อัตโนมัติ** (`npm test`) — ตรวจความถูกต้องของตรรกะหลัก

## สถาปัตยกรรม

```
[อัปโหลด/ลิงก์]
   ├─ /api/transcribe  (ไฟล์)  ┐
   └─ /api/import      (YouTube)┴─> ffmpeg แยกเสียง -> scripts/transcribe.py (Whisper) -> job.json

AI ใส่ซับ:      /studio    -> /api/render  -> .ass + .srt -> ffmpeg เบิร์นซับ -> output.mp4
AI ตัดคลิป:     /repurpose -> /api/clips (หาช่วงไวรัล)
                            -> /api/cut   -> ffmpeg ตัด + scripts/reframe.py (ใบหน้า) -> งานใหม่ -> /studio
ตรวจระบบ:       /check     -> /api/health

* งานหนัก (ถอดเสียง/เรนเดอร์/ตัดคลิป) รันเบื้องหลัง เขียนสถานะที่ storage/<id>/status.json
  ฝั่ง client poll /api/status/<id> เพื่อแสดงแถบ %
```

- **Frontend/Backend:** Next.js 14 (App Router) + TypeScript + Tailwind
- **ถอดเสียง:** faster-whisper (รันบนเครื่อง ไม่ต้องใช้ API)
- **ตัดคลิป/เรนเดอร์/รีเฟรม:** FFmpeg + libass
- **ตรวจจับใบหน้า:** OpenCV (ไม่บังคับ)
- **นำเข้า YouTube:** yt-dlp (ไม่บังคับ)

## ความต้องการของระบบ

| เครื่องมือ | จำเป็น | ใช้ทำอะไร |
|---|---|---|
| Node.js 18+ | ✅ | รันเว็บแอพ |
| FFmpeg + ffprobe (ใน PATH) | ✅ | แยกเสียง ตัดคลิป เบิร์นซับ |
| Python 3.9+ + faster-whisper | ✅ | ถอดเสียงไทย |
| ฟอนต์ไทย (Sarabun / Noto Sans Thai) | ⭐ แนะนำ | เบิร์นซับไทยให้อ่านออก |
| OpenCV (opencv-python) | ◻️ ไม่บังคับ | รีเฟรม 9:16 ตามใบหน้า |
| yt-dlp | ◻️ ไม่บังคับ | นำเข้าจากลิงก์ YouTube |
| LLM API key (Anthropic/OpenAI) | ◻️ ไม่บังคับ | จัดอันดับ + ตั้งชื่อคลิปไวรัลด้วย AI |

## วิธีติดตั้ง

```bash
# 1) dependencies ฝั่ง Node
npm install

# 2) Whisper (จำเป็น) + ของเสริม
pip install -r scripts/requirements.txt          # faster-whisper
pip install opencv-python                          # (เสริม) รีเฟรมตามใบหน้า
pip install yt-dlp        # หรือ: brew install yt-dlp  (เสริม) นำเข้า YouTube

# 3) ตั้งค่า env (เลือกได้)
cp .env.example .env.local

# 4) วางฟอนต์ไทยใน ./fonts (แนะนำ Sarabun-Bold.ttf, NotoSansThai-Bold.ttf)

# 5) รัน แล้วเปิด http://localhost:3000
npm run dev
```

หลังติดตั้ง เปิด `http://localhost:3000/check` เพื่อตรวจว่าทุกอย่างพร้อม

## การใช้งาน

**AI ใส่ซับ:** หน้าแรกเลือกแท็บ "AI ใส่ซับ" → อัปโหลด/วางลิงก์ → รอถอดเสียง → หน้า Studio เลือกสไตล์/แก้ข้อความ → กด Render & ดาวน์โหลด

**แผน/เครดิต:** ดูที่ `/pricing` — แต่ละครั้งที่ Render หัก 1 เครดิต, แผน Free ติดลายน้ำ + จำกัด 2 นาที/ไฟล์ (เดโม: เปลี่ยนแผนได้ทันที ระบบเก็บบัญชีไว้ใน `storage/accounts.json` ผูกกับ cookie)

**AI ตัดคลิปไวรัล:** หน้าแรกเลือกแท็บ "AI ตัดคลิปไวรัล" → อัปโหลดคลิปยาว → ระบบจัดอันดับช่วงที่น่าจะไวรัล (#1, #2, …) พร้อมคะแนน → เลือกคลิป (เปิด/ปิดแนวตั้ง 9:16) → ระบบตัด + พาไปใส่ซับต่อ

## การตรวจสอบความถูกต้อง

มี 2 ชั้น:

1. **หน้าตรวจสอบระบบ** `/check` (เรียก `/api/health`) — ตรวจว่ามี ffmpeg, ffprobe, python, faster-whisper, opencv, yt-dlp และฟอนต์ไทยหรือยัง บอกสถานะแต่ละตัว
2. **ชุดเทสต์อัตโนมัติ** — รัน `npm test` (ใช้ Node test runner + type stripping ไม่ต้องลง dependency เพิ่ม)

```bash
npm test
# ครอบคลุม: การสร้างไฟล์ .ass (สี/เวลา/ไฮไลท์คำ/กล่อง/ฟิลด์), .srt,
#           การแบ่ง cue, หาคลิปไวรัล, จัดอันดับ, เทมเพลต, เครดิต/แผน

npm run test:integration
# รัน pipeline จริงด้วย ffmpeg: สร้างวิดีโอ -> เบิร์นซับ+ลายน้ำ -> ตัดคลิป -> รีเฟรม 9:16
# ต้องมี ffmpeg/ffprobe ใน PATH
```

ผลล่าสุด: **ผ่าน 123/123 เทสต์** (unit) + **13/13** (integration ด้วย ffmpeg จริง)

## โครงสร้างไฟล์

```
app/
  page.tsx                    Landing + สลับโปรดักต์ + อัปโหลด/ลิงก์
  studio/page.tsx             ใส่ซับ: แก้ไข + พรีวิว + render
  repurpose/page.tsx          ตัดคลิปไวรัล: รายการคลิป + คะแนน
  check/page.tsx              หน้าตรวจสอบระบบ
  api/transcribe              อัปโหลดไฟล์ -> Whisper
  api/import                  ลิงก์ YouTube -> yt-dlp -> Whisper
  api/clips/[id]              หาช่วงไวรัลจาก transcript
  api/cut                     ตัดคลิป + รีเฟรม 9:16 -> งานใหม่
  api/render                  .ass/.srt -> เบิร์นซับ
  api/job/[id]                ดึงข้อมูลงาน
  api/file/[id]/[name]        เสิร์ฟไฟล์วิดีโอ/ซับ
  api/health                  สถานะเครื่องมือระบบ
  api/jobs(+[id])             list/delete งานทั้งหมด
  jobs/page.tsx               Dashboard งาน
  api/account                 บัญชี/เครดิต/แผน (cookie uid)
  api/status/[id]             สถานะงาน + % (สำหรับ polling)
  pricing/page.tsx            หน้าแผน + ราคา (เปลี่ยนแผนได้)
components/                   ProductSwitch, UploadDropzone, StylePicker,
                             SubtitleEditor, VideoPreview, CreditBadge,
                             ProgressBar, poll, useCustomTemplates
lib/                          types, styles, ass, srt, srtparse, cues, clips,
                             templates, rank, keywords, emoji, caption, search,
                             clean, editops, translate, aspect, export, credits, accounts,
                             progress, jobstatus, jobsummary, queue, cleanup,
                             ffmpeg, pipeline, storage
scripts/transcribe.py        faster-whisper (Thai, word timestamps)
scripts/reframe.py           OpenCV face detection -> จุดโฟกัสแนวนอน
tests/                       ชุดเทสต์ (node:test)
fonts/                       ฟอนต์ไทยสำหรับ libass
storage/<jobId>/             ไฟล์ของแต่ละงาน (git ignored)
```

## หมายเหตุ

- ต้องมีฟอนต์ไทยให้ libass หา ไม่งั้นซับจะเป็นช่องว่าง/สี่เหลี่ยม — วางไฟล์ใน `./fonts/`
  และให้ชื่อ family ตรงกับใน `lib/styles.ts`
- โมเดล Whisper ใหญ่ขึ้น (`medium`, `large-v3`) แม่นกว่าแต่ช้ากว่า; มี GPU (CUDA) จะเร็วขึ้นมาก
- การหาคลิปไวรัลใช้ heuristic (ภาษาไทย) — ปรับคำดึงดูด/น้ำหนักคะแนนได้ใน `lib/clips.ts`
- **การจัดอันดับด้วย AI**: ตั้ง `ANTHROPIC_API_KEY` หรือ `OPENAI_API_KEY` ใน `.env.local`
  ระบบจะ re-rank + ตั้งชื่อพาดหัวให้อัตโนมัติ (ดู `lib/rank.ts`) ถ้าไม่ตั้งก็ใช้ heuristic
- **เทมเพลตส่วนตัว**: กด "บันทึกสไตล์นี้เป็นเทมเพลต" ในหน้า Studio — เก็บใน localStorage ของเบราว์เซอร์
  (ตรรกะ validate/merge อยู่ใน `lib/templates.ts`)
- **เครดิต/แผน**: ตรรกะอยู่ใน `lib/credits.ts` (pure, มีเทสต์) + เก็บบัญชีไฟล์ `lib/accounts.ts`
  เดโมใช้ cookie แทน auth จริง — ถ้าจะขึ้น production ให้ต่อ auth + DB และคิดเงินจริงผ่าน payment gateway

## Deploy (Docker) + CI

> ดูขั้นตอนขึ้นออนไลน์จริง (Railway/Render/VPS) ได้ที่ **DEPLOY.md**

รันทั้งระบบ (Node + FFmpeg + Whisper + ฟอนต์ไทย) ในคอนเทนเนอร์เดียว:

```bash
# build + run ด้วย docker compose (เก็บงานไว้ใน ./storage)
docker compose up --build
# เปิด http://localhost:3000

# หรือ build/run เอง
docker build -t subthai-ai .
docker run -p 3000:3000 -v "$PWD/storage:/app/storage" subthai-ai
```

อิมเมจติดตั้งให้แล้ว: `ffmpeg`, `python3` + `faster-whisper`, `opencv-python-headless`
(รีเฟรมใบหน้า), `yt-dlp` (นำเข้า YouTube), ฟอนต์ `fonts-thai-tlwg` + `fonts-noto-core`
ตั้งค่า `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` ผ่าน env เพื่อเปิด AI จัดอันดับ

**CI:** `.github/workflows/ci.yml` รันทุก push/PR — ติดตั้ง FFmpeg, `npm test`,
`npm run test:integration`, แล้ว `npm run build` (ใช้ Node 22 สำหรับ type-stripping ของเทสต์)

## ส่วนขยายที่ทำต่อได้

- auth จริง + payment gateway + คิว render บน worker แยก
- เก็บไฟล์บน object storage (เช่น S3) แทน local disk — มี seam ที่ `lib/storage.ts`
