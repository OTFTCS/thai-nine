import path from "node:path";

export function isPathAllowed(raw: string, root: string): boolean {
  if (!raw || typeof raw !== "string") return false;
  const resolved = path.resolve(raw);
  if (resolved === root) return false;
  return resolved.startsWith(root + path.sep);
}
