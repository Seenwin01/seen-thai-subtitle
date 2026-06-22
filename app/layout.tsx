import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import PWARegister from "@/components/PWARegister";

const thai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-thai",
});

export const metadata: Metadata = {
  title: "ซับไทย AI — ใส่ซับไตเติ้ลให้ไวรัลใน 5 นาที",
  description:
    "AI ถอดเสียงไทยแม่นยำ ใส่ซับไตเติ้ลสวยอัตโนมัติ เลือกสไตล์ไวรัล ตัดคลิป แปลภาษา แล้วดาวน์โหลดได้ทันที",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ซับไทย AI" },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={thai.variable}>
      <body className="font-sans antialiased">
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
