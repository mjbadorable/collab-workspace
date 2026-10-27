// Client-side avatar processing: shrink to a small square-bounded image and encode as WebP (JPEG fallback).

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file could not be read as an image."));
    img.src = src;
  });

// Approximate decoded size of a base64 data URL.
const bytesOf = (dataUrl: string) => Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);

function encode(img: HTMLImageElement, max: number, maxBytes: number): string {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is not available in this browser.");
  ctx.fillStyle = "#ffffff"; // JPEG has no alpha, and transparent PNGs would turn black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Browsers that cannot encode WebP silently return PNG, so check the prefix and fall back to JPEG.
  const webp = canvas.toDataURL("image/webp", 0.8).startsWith("data:image/webp");
  const type = webp ? "image/webp" : "image/jpeg";
  let out = canvas.toDataURL(type, 0.85);
  for (let quality = 0.75; quality >= 0.3 && bytesOf(out) > maxBytes; quality -= 0.1) {
    out = canvas.toDataURL(type, quality);
  }
  return out;
}

// Resizes an uploaded photo to at most 256x256 and under ~40 KB.
export async function fileToAvatar(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  const url = URL.createObjectURL(file);
  try {
    return encode(await loadImage(url), 256, 40_000);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// A tiny copy for places with tight size limits (Supabase user metadata travels inside the auth token).
export async function shrinkDataUrl(dataUrl: string, max: number, maxBytes: number): Promise<string> {
  return encode(await loadImage(dataUrl), max, maxBytes);
}
