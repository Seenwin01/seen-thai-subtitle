import path from "path";
import fs from "fs";

// All job artifacts live under ./storage/<jobId>/
export const STORAGE_ROOT = path.join(process.cwd(), "storage");

export function jobDir(jobId: string): string {
  const dir = path.join(STORAGE_ROOT, jobId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function jobPath(jobId: string, file: string): string {
  return path.join(jobDir(jobId), file);
}

export function newJobId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toLowerCase();
}

// Guard against path traversal in job ids coming from the client.
export function safeJobId(id: string): string {
  if (!/^[a-z0-9]+$/i.test(id)) throw new Error("invalid job id");
  return id;
}
