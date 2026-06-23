export const runtime = "nodejs";

// Diagnostic: does this server's Node have working Thai word segmentation?
export async function GET() {
  const test = "ว่างมากินหนูไว้กินข้าวกับหนูไหมคะ";
  let available = false;
  let segments: string[] = [];
  let err: string | null = null;
  let node = "";
  try {
    node = process.version;
    available =
      typeof Intl !== "undefined" && typeof Intl.Segmenter === "function";
    if (available) {
      const seg = new Intl.Segmenter("th", { granularity: "word" });
      segments = Array.from(seg.segment(test)).map(
        (s: { segment: string }) => s.segment
      );
    }
  } catch (e) {
    err = String(e);
  }
  return Response.json({
    available,
    count: segments.length,
    works: segments.length > 3,
    segments,
    err,
    node,
  });
}
