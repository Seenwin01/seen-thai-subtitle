"use client";

export default function ProgressBar({
  progress,
  step,
}: {
  progress: number;
  step: string;
}) {
  return (
    <div className="w-full">
      <div className="mb-2 flex justify-between text-sm text-white/70">
        <span>{step || "กำลังประมวลผล…"}</span>
        <span className="font-semibold text-brand-300">{Math.round(progress)}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full btn-grad transition-all duration-500"
          style={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
        />
      </div>
    </div>
  );
}
