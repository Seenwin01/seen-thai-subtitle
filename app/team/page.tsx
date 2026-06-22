import Link from "next/link";

interface Member {
  name: string;
  role: string;
  bio: string;
  initial: string;
  tint: string; // avatar gradient
}

const team: Member[] = [
  { name: "ปุณณ์ ศรีสุข", role: "Founder & CEO", bio: "วางวิสัยทัศน์ผลิตภัณฑ์และทิศทางบริษัท", initial: "ป", tint: "from-sky-400 to-blue-600" },
  { name: "ธนกร วงศ์ไพศาล", role: "CTO", bio: "ดูแลสถาปัตยกรรมระบบและทีมวิศวกรรม", initial: "ธ", tint: "from-cyan-400 to-sky-600" },
  { name: "มินตรา จันทร์เพ็ญ", role: "Head of AI", bio: "โมเดลถอดเสียงไทยและฟีเจอร์ AI", initial: "ม", tint: "from-blue-400 to-indigo-600" },
  { name: "กิตติพงษ์ รุ่งเรือง", role: "Lead Engineer", bio: "ไปป์ไลน์เรนเดอร์วิดีโอและประสิทธิภาพ", initial: "ก", tint: "from-sky-500 to-cyan-600" },
  { name: "ศุภิสรา ภักดี", role: "Product Designer", bio: "ออกแบบประสบการณ์ใช้งานและสไตล์ซับ", initial: "ศ", tint: "from-indigo-400 to-blue-600" },
  { name: "ณัฐวุฒิ พงษ์สิน", role: "Growth", bio: "การตลาด ชุมชนครีเอเตอร์ และพาร์ตเนอร์", initial: "ณ", tint: "from-cyan-400 to-blue-500" },
];

const stats = [
  { n: "13,000+", l: "ครีเอเตอร์ที่ไว้วางใจ" },
  { n: "98%", l: "ความแม่นยำถอดเสียง" },
  { n: "15", l: "ภาษาที่รองรับ" },
  { n: "24/7", l: "ระบบทำงานต่อเนื่อง" },
];

export default function TeamPage() {
  return (
    <div className="blue-bg min-h-screen">
      <main className="mx-auto max-w-6xl px-5 pb-24">
        {/* Nav */}
        <nav className="flex items-center justify-between py-6">
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            ซับไทย<span className="text-sky-400">AI</span>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 text-sm text-sky-100/70">
            <Link href="/" className="hover:text-white">หน้าแรก</Link>
            <Link href="/pricing" className="hover:text-white">ราคา</Link>
            <Link href="/team" className="text-white">ทีม</Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="py-14 text-center">
          <span className="crystal inline-block rounded-full px-4 py-1.5 text-xs text-sky-100">
            ทีมงานของเรา
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">
            คนเบื้องหลัง <span className="text-ice">ซับไทย AI</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sky-100/70">
            ทีมเล็กที่หลงใหลในคอนเทนต์ไทย เราสร้างเครื่องมือใส่ซับและตัดคลิปด้วย AI
            ให้ครีเอเตอร์ทำงานเร็วขึ้นและสวยขึ้น
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#open-roles" className="btn-lux px-7 py-3">ร่วมงานกับเรา</a>
            <a href="#contact" className="btn-lux-outline px-7 py-3">ติดต่อทีม</a>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.l} className="crystal fade-in p-6 text-center">
              <div className="text-2xl font-extrabold text-ice md:text-3xl">{s.n}</div>
              <div className="mt-1 text-xs text-sky-100/60">{s.l}</div>
            </div>
          ))}
        </section>

        {/* Members */}
        <section className="mt-16">
          <h2 className="text-center text-3xl font-extrabold">พบกับทีม</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((m) => (
              <div key={m.name} className="crystal fade-in p-6">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${m.tint} text-2xl font-extrabold text-white shadow-lg`}
                  >
                    {m.initial}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{m.name}</h3>
                    <p className="text-sm text-sky-300">{m.role}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-sky-100/60">{m.bio}</p>
                <div className="mt-5 flex gap-2">
                  <button className="btn-lux flex-1 px-4 py-2 text-sm">โปรไฟล์</button>
                  <button className="btn-lux-outline px-4 py-2 text-sm">ติดตาม</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Open roles */}
        <section id="open-roles" className="crystal mt-16 p-10 text-center">
          <h2 className="text-2xl font-extrabold md:text-3xl">เรากำลังขยายทีม</h2>
          <p className="mx-auto mt-2 max-w-xl text-sky-100/65">
            ถ้าคุณรักการสร้างผลิตภัณฑ์สำหรับครีเอเตอร์ไทย มาคุยกัน
          </p>
          <div id="contact" className="mt-7 flex flex-wrap justify-center gap-3">
            <a href="mailto:jobs@subthai.ai" className="btn-lux px-7 py-3">ส่งใบสมัคร</a>
            <a href="mailto:hello@subthai.ai" className="btn-lux-outline px-7 py-3">hello@subthai.ai</a>
          </div>
        </section>

        <footer className="mt-16 text-center text-xs text-sky-100/40">
          © {new Date().getFullYear()} ซับไทย AI — เดโมโคลน Klipr (เพื่อการเรียนรู้)
        </footer>
      </main>
    </div>
  );
}
