/**
 * Client-Side Image Compressor
 * Resizes and compresses user avatars and property photos on HTML5 Canvas
 * Keeps Firebase Storage usage well within free tier limits ($0 cost)
 */

export function dataURLtoBlob(dataUrl: string): Blob {
  const commaIndex = dataUrl.indexOf(',');
  const header = commaIndex > -1 ? dataUrl.slice(0, commaIndex) : '';
  let base64Data = commaIndex > -1 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  try {
    if (base64Data.includes('%')) {
      base64Data = decodeURIComponent(base64Data);
    }
  } catch {
    // Ignore decode error and continue with raw base64
  }
  const cleanBase64 = base64Data.replace(/[\r\n\s]/g, '');
  const mimeMatch = header.match(/:(.*?)(;|$)/);
  const mimeType = mimeMatch && mimeMatch[1] ? mimeMatch[1] : 'image/jpeg';
  const binaryString = typeof atob === 'function' ? atob(cleanBase64) : Buffer.from(cleanBase64, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export async function compressImage(
  source: File | Blob | string,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.82
): Promise<Blob> {
  // If in node or environments without browser canvas/Image, fall back gracefully
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof Image === 'undefined') {
    if (source instanceof Blob) return source;
    if (typeof source === 'string') return dataURLtoBlob(source);
    return source as unknown as Blob;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();

    const handleLoadedImage = () => {
      let width = img.width || 1200;
      let height = img.height || 800;

      // Calculate aspect ratio scaling
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        if (source instanceof Blob) resolve(source);
        else if (typeof source === 'string') resolve(dataURLtoBlob(source));
        else resolve(source as unknown as Blob);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            if (source instanceof Blob) resolve(source);
            else if (typeof source === 'string') resolve(dataURLtoBlob(source));
            else resolve(source as unknown as Blob);
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onload = handleLoadedImage;
    img.onerror = (err) => {
      if (source instanceof Blob) resolve(source);
      else if (typeof source === 'string') resolve(dataURLtoBlob(source));
      else reject(err);
    };

    if (typeof source === 'string') {
      img.src = source;
    } else if (source instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (event) => {
        img.src = (event.target?.result as string) || '';
      };
      reader.onerror = () => {
        resolve(source);
      };
      reader.readAsDataURL(source);
    } else {
      resolve(source as unknown as Blob);
    }
  });
}
