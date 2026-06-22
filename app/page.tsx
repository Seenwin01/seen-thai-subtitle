import ProductSwitch from "@/components/ProductSwitch";

const features = [
  { t: "ถอดเสียงภาษาไทย", d: "AI (Whisper) ถอดเสียงไทยพร้อม timestamp ทุกคำ รันบนเครื่องคุณเอง" },
  { t: "14+ สไตล์ซับไวรัล", d: "เลือกจาก 14+ เทมเพลตไวรัล หรือปรับสี ฟอนต์ ตำแหน่งเองได้" },
  { t: "ไฮไลท์คำสำคัญ", d: "เน้นคำที่กำลังพูดแบบคาราโอเกะ ดึงดูดสายตาคนดู" },
  { t: "ตัดคลิปไวรัล + จัดอันดับ", d: "หาช่วงเด็ดจากคลิปยาว จัดอันดับโอกาสไวรัล แล้วตัดให้อัตโนมัติ" },
  { t: "เบิร์นซับลงวิดีโอ", d: "ฝังซับลงคลิปด้วย FFmpeg ได้ไฟล์ MP4 พร้อมลง" },
  { t: "ส่งออก SRT / MP4", d: "ดาวน์โหลดไฟล์ซับหรือวิดีโอที่ฝังซับแล้ว" },
];

const steps = [
  { n: "01", t: "อัปโหลดวิดีโอ", d: "ลากไฟล์มาวาง หรือวางลิงก์ YouTube" },
  { n: "02", t: "AI ถอดเสียง", d: "Whisper ถอดเสียงไทยพร้อม timestamp ทุกคำ" },
  { n: "03", t: "เลือกสไตล์", d: "เลือกเทมเพลต ปรับสี ฟอนต์ ไฮไลท์ได้ตามใจ" },
  { n: "04", t: "ดาวน์โหลด", d: "Render คลิปพร้อมซับ Full HD ลงได้เลย" },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-5 pb-24">
      {/* Nav */}
      <nav className="flex items-center justify-between py-6">
        <div className="text-xl font-extrabold tracking-tight">
          ซับไทย<span className="text-brand-400">AI</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 text-sm text-white/70">
          <a href="#features" className="hover:text-white">ฟีเจอร์</a>
          <a href="#how" className="hover:text-white">วิธีใช้งาน</a>
          <a href="/jobs" className="hover:text-white">งานของฉัน</a>
          <a href="/pricing" className="hover:text-white">ราคา</a>
          <a href="/team" className="hover:text-white">ทีม</a>
          <a href="/check" className="hover:text-white">ตรวจสอบระบบ</a>
          <a href="#upload" className="hover:text-white">เริ่มใช้งาน</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="grid items-center gap-10 py-12 md:grid-cols-2">
        <div>
          <span className="glass inline-block rounded-full px-3 py-1 text-xs text-brand-100">
            AI ใส่ซับ · ภาษาไทย
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight md:text-5xl">
            ใส่ซับไตเติ้ลให้{" "}
            <span className="bg-gradient-to-r from-brand-400 to-fuchsia-400 bg-clip-text text-transparent">
              ไวรัล
            </span>{" "}
            ภายใน 5 นาที
          </h1>
          <p className="mt-4 text-white/70">
            AI ถอดเสียงไทยแม่นยำ ใส่ซับไตเติ้ลสวยอัตโนมัติ เลือกสไตล์ แล้วโพสต์ได้ทันที
          </p>
          <div className="mt-7 flex gap-4 text-sm">
            <div className="glass rounded-xl px-4 py-3">
              ถอดเสียงแม่นยำ <b className="text-brand-300">98%</b>
            </div>
            <div className="glass rounded-xl px-4 py-3">
              รองรับ <b className="text-brand-300">50+</b> ภาษา
            </div>
          </div>
        </div>

        <div id="upload">
          <ProductSwitch />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16">
        <h2 className="text-center text-3xl font-extrabold">
          ทุกอย่างที่ต้องใช้ ใส่ซับให้ไวรัล
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.t} className="glass fade-in rounded-2xl p-6">
              <h3 className="text-lg font-bold text-brand-200">{f.t}</h3>
              <p className="mt-2 text-sm text-white/60">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-16">
        <h2 className="text-center text-3xl font-extrabold">
          4 ขั้นตอน เสร็จใน 5 นาที
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="glass fade-in rounded-2xl p-6">
              <div className="text-3xl font-extrabold text-brand-500/70">{s.n}</div>
              <h3 className="mt-3 font-bold">{s.t}</h3>
              <p className="mt-1 text-sm text-white/60">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="glass mt-8 rounded-3xl p-10 text-center">
        <h2 className="text-2xl font-extrabold md:text-3xl">
          พร้อมใส่ซับไตเติ้ลแบบมืออาชีพ?
        </h2>
        <p className="mt-2 text-white/60">ใช้เวลาไม่ถึง 5 นาที เริ่มได้เลย</p>
        <a
          href="#upload"
          className="btn-grad mt-6 inline-block rounded-xl px-7 py-3 font-semibold"
        >
          เริ่มใส่ซับเลย
        </a>
      </section>

      <footer className="mt-16 text-center text-xs text-white/40">
        © {new Date().getFullYear()} ซับไทย AI — เดโมโคลน Klipr (เพื่อการเรียนรู้)
      </footer>
    </main>
  );
}
