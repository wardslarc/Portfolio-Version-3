import { slugify } from "./slug";

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_WIDTH = 2400;

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
  filename: string;
}

function loadHtmlImage(file: Blob): Promise<{ width: number; height: number; source: CanvasImageSource; cleanup: () => void }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        source: img,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image file."));
    };
    img.src = objectUrl;
  });
}

function canvasToWebpBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not convert image to WebP."));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      0.85,
    );
  });
}

/**
 * Validates type & size, resizes non-GIF images to at most 2400px wide,
 * and encodes them as WebP (quality 0.85) in the browser before upload.
 */
export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as AllowedImageType)) {
    throw new Error("Unsupported image type. Use JPEG, PNG, WebP, GIF, or AVIF.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`${file.name} is over 8 MB.`);
  }

  const baseName = slugify(file.name.replace(/\.[^.]+$/, "")) || "image";

  const loaded = await loadHtmlImage(file);
  try {
    if (file.type === "image/gif") {
      return {
        blob: file,
        width: loaded.width,
        height: loaded.height,
        filename: `${baseName}.gif`,
      };
    }

    const targetWidth = Math.min(loaded.width, MAX_IMAGE_WIDTH);
    const targetHeight = Math.max(
      1,
      Math.round((loaded.height * targetWidth) / Math.max(1, loaded.width)),
    );

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is unavailable.");
    }
    ctx.drawImage(loaded.source, 0, 0, targetWidth, targetHeight);
    const blob = await canvasToWebpBlob(canvas);

    return {
      blob,
      width: targetWidth,
      height: targetHeight,
      filename: `${baseName}.webp`,
    };
  } finally {
    loaded.cleanup();
  }
}
