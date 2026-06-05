export function slugify(input: string): string {
  const cleaned = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return cleaned || "guest";
}

export function fileExtension(name: string, fallback = "jpg"): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return (match?.[1] ?? fallback).toLowerCase();
}
