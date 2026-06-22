import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <div className="text-6xl font-extrabold text-brand-500/60">404</div>
      <h1 className="mt-3 text-xl font-bold">ไม่พบหน้านี้</h1>
      <p className="mt-1 text-sm text-white/60">ลิงก์อาจหมดอายุหรือพิมพ์ผิด</p>
      <Link href="/" className="btn-grad mt-6 rounded-xl px-6 py-2.5 font-semibold">
        กลับหน้าแรก
      </Link>
    </main>
  );
}
