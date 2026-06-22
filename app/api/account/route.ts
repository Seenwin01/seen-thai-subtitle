import { NextRequest, NextResponse } from "next/server";
import { getAccount, isValidUid, setPlan } from "@/lib/accounts";
import { PLANS, PlanId, getPlan } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "uid";

function newUid(): string {
  return (
    "u" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

function readUid(req: NextRequest): { uid: string; fresh: boolean } {
  const c = req.cookies.get(COOKIE)?.value;
  if (c && isValidUid(c)) return { uid: c, fresh: false };
  return { uid: newUid(), fresh: true };
}

function payload(uid: string) {
  const acc = getAccount(uid);
  return { account: acc, plan: getPlan(acc.planId), plans: PLANS };
}

export async function GET(req: NextRequest) {
  const { uid, fresh } = readUid(req);
  const res = NextResponse.json(payload(uid));
  if (fresh) {
    res.cookies.set(COOKIE, uid, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}

export async function POST(req: NextRequest) {
  const { uid, fresh } = readUid(req);
  const body = (await req.json().catch(() => ({}))) as { planId?: PlanId };
  const valid = PLANS.some((p) => p.id === body.planId);
  if (!valid) {
    return NextResponse.json({ error: "invalid plan" }, { status: 400 });
  }
  setPlan(uid, body.planId as PlanId);
  const res = NextResponse.json(payload(uid));
  if (fresh) {
    res.cookies.set(COOKIE, uid, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}
