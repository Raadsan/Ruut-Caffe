/** Resize & compress logo image for receipt storage (base64 data URL). */
export async function fileToReceiptLogoDataUrl(
  file: File,
  maxDim = 480,
  maxBytes = 900_000
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (PNG, JPG, WEBP).");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Invalid image file."));
    el.src = dataUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);

  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  let quality = 0.92;
  let out = canvas.toDataURL(mime, quality);

  while (out.length > maxBytes && quality > 0.45) {
    quality -= 0.08;
    out = canvas.toDataURL(mime, quality);
  }

  if (out.length > maxBytes) {
    throw new Error("Logo is too large. Use a smaller image (under 1MB).");
  }

  return out;
}
