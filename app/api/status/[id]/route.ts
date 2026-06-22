import { NextRequest, NextResponse } from "next/server";
import { safeJobId } from "@/lib/storage";
import { getStatus } from "@/lib/jobstatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = safeJobId(params.id);
    const status = getStatus(id);
    if (!status) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(status);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 400 });
  }
}
