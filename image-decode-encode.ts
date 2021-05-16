// Encoding an image is also done by sticking pixels in an
// HTML canvas and by asking the canvas to serialize it into
// an actual PNG file via canvas.toBlob()
export async function encodeFromImageData(canvas, ctx, imageData) {
  ctx.putImageData(imageData, 0, 0)

  return await new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(<ArrayBuffer>reader.result));
      reader.onerror = () => reject(new Error('Could not read from blob'));
      reader.readAsArrayBuffer(blob);
    })
  })
}

// Decoding an image can be done by sticking it in an HTML canvas,
// since we can read individual pixels off the canvas.
export async function decodeToImageData(bytes): Promise<ImageData> {
  const url = URL.createObjectURL(new Blob([bytes]));
  const image: HTMLImageElement = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject();
    img.src = url;
  });

  let canvas = document.createElement('canvas');
  let ctx = canvas.getContext('2d');
  ctx.canvas.width = image.width;
  ctx.canvas.height = image.height;
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, image.width, image.height);
  return imageData;
}



export function getImageDataPixel(imageData: ImageData, x: number, y: number, constrain = true): RGBA {
  x = Math.round(x);
  y = Math.round(y);
  if (constrain) {
    x = Math.max(0, Math.min(x, imageData.width - 1));
    y = Math.max(0, Math.min(y, imageData.height - 1));
  }
  if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) {
    return null;
  }

  return {
    r: imageData.data[(y * imageData.width + x) * 4] / 255,
    g: imageData.data[(y * imageData.width + x) * 4 + 1] / 255,
    b: imageData.data[(y * imageData.width + x) * 4 + 2] / 255,
    a: imageData.data[(y * imageData.width + x) * 4 + 3] / 255,
  };
}