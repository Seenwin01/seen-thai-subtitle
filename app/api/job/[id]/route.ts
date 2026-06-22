import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { jobPath, safeJobId } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = safeJobId(params.id);
    const p = jobPath(id, "job.json");
    if (!fs.existsSync(p)) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 400 });
  }
}
