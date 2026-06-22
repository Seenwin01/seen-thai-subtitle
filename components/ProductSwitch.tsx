"use client";

import { useState } from "react";
import UploadDropzone from "./UploadDropzone";

// Klipr-style two-product switch: AI Subtitle vs AI Repurposing.
export default function ProductSwitch() {
  const [product, setProduct] = useState<"subtitle" | "repurpose">("subtitle");

  return (
    <div>
      <div className="mb-4 flex gap-2 rounded-xl bg-white/5 p-1 text-sm">
        <button
          onClick={() => setProduct("subtitle")}
          className={`flex-1 rounded-lg px-3 py-2 transition ${
            product === "subtitle" ? "btn-grad font-semibold" : "text-white/60"
          }`}
        >
          AI ใส่ซับ
        </button>
        <button
          onClick={() => setProduct("repurpose")}
          className={`flex-1 rounded-lg px-3 py-2 transition ${
            product === "repurpose" ? "btn-grad font-semibold" : "text-white/60"
          }`}
        >
          AI ตัดคลิปไวรัล
        </button>
      </div>
      <UploadDropzone
        key={product}
        target={product === "repurpose" ? "repurpose" : "studio"}
      />
      <p className="mt-3 text-center text-xs text-white/40">
        {product === "subtitle"
          ? "ใส่ซับไตเติ้ลภาษาไทยอัตโนมัติ"
          : "ตัดวิดีโอยาวเป็นคลิปสั้นไวรัล แล้วใส่ซับต่อได้เลย"}
      </p>
    </div>
  );
}
