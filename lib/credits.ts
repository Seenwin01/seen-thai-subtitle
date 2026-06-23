// ---------------------------------------------------------------------------
// Credit & plan system (modelled on Klipr's pricing).
// Pure functions only — the file-backed store lives in lib/accounts.ts.
// ---------------------------------------------------------------------------

export type PlanId = "free" | "viral_sub" | "viral_talk";
export type Cycle = "month" | "year";

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number; // THB
  priceYearly: number; // THB
  credits: number; // credits granted per cycle
  cycle: Cycle;
  maxClipMinutes: number; // max uploaded/rendered length per file
  watermark: boolean;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    priceYearly: 0,
    credits: 10,
    cycle: "month",
    maxClipMinutes: 999,
    watermark: true,
    features: [
      "10 เครดิต/เดือน",
      "ใส่ซับอัตโนมัติด้วย AI",
      "อัปโหลดสูงสุด 2 นาที/ไฟล์",
      "ติดลายน้ำ",
    ],
  },
  {
    id: "viral_sub",
    name: "Viral Sub",
    priceMonthly: 224,
    priceYearly: 2688,
    credits: 1200,
    cycle: "year",
    maxClipMinutes: 5,
    watermark: false,
    features: [
      "1,200 เครดิต/ปี",
      "ใส่ซับอัตโนมัติ + AI เน้นคำ",
      "อัปโหลดสูงสุด 5 นาที/ไฟล์",
      "ไม่มีลายน้ำ + ส่งออก SRT",
    ],
  },
  {
    id: "viral_talk",
    name: "Viral Talk",
    priceMonthly: 299,
    priceYearly: 3588,
    credits: 3600,
    cycle: "year",
    maxClipMinutes: 60,
    watermark: false,
    features: [
      "3,600 เครดิต/ปี",
      "ตัดคลิปไวรัล + ตรวจจับใบหน้า",
      "อัปโหลดสูงสุด 60 นาที/ไฟล์",
      "ไม่มีลายน้ำ + เชิญทีมได้",
    ],
  },
];

export function getPlan(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/** Credits charged to export (render) one clip. */
export const RENDER_COST = 1;

export interface Account {
  id: string;
  email?: string;
  planId: PlanId;
  credits: number;
  /** ISO timestamp marking the start of the current billing cycle */
  cycleStart: string;
}

export function newAccount(
  id: string,
  planId: PlanId = "free",
  now: Date = new Date()
): Account {
  const plan = getPlan(planId);
  return {
    id,
    planId,
    credits: plan.credits,
    cycleStart: now.toISOString(),
  };
}

/** Has the account's billing cycle (month/year) rolled over since cycleStart? */
export function needsReset(acc: Account, now: Date = new Date()): boolean {
  const start = new Date(acc.cycleStart);
  if (Number.isNaN(start.getTime())) return true;
  const plan = getPlan(acc.planId);
  const next = new Date(start);
  if (plan.cycle === "month") next.setMonth(next.getMonth() + 1);
  else next.setFullYear(next.getFullYear() + 1);
  return now >= next;
}

/** Refill credits for a new cycle. */
export function applyReset(acc: Account, now: Date = new Date()): Account {
  const plan = getPlan(acc.planId);
  return { ...acc, credits: plan.credits, cycleStart: now.toISOString() };
}

export function canAfford(acc: Account, cost: number): boolean {
  return acc.credits >= cost;
}

/** Deduct credits (caller must check canAfford first). */
export function charge(acc: Account, cost: number): Account {
  return { ...acc, credits: Math.max(0, acc.credits - cost) };
}

/** Switch plan and grant the new plan's credits, starting a fresh cycle. */
export function changePlan(
  acc: Account,
  planId: PlanId,
  now: Date = new Date()
): Account {
  const plan = getPlan(planId);
  return { ...acc, planId, credits: plan.credits, cycleStart: now.toISOString() };
}

/** Is a clip of the given duration allowed on the account's plan? */
export function withinLimit(acc: Account, durationSec: number): boolean {
  const plan = getPlan(acc.planId);
  return durationSec <= plan.maxClipMinutes * 60 + 1; // +1s tolerance
}
