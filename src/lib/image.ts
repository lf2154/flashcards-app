import { AppError } from './errors'

// 插入圖片前先壓縮：長邊最大 1600px、JPEG 品質 0.8（SPEC 4.4）。

export const MAX_IMAGE_SIDE = 1600
const JPEG_QUALITY = 0.8

/** 等比縮小到長邊不超過 max（本來就小的不放大） */
export function fitWithin(width: number, height: number, max = MAX_IMAGE_SIDE): { width: number; height: number } {
  const long = Math.max(width, height)
  if (long <= max) return { width, height }
  const r = max / long
  return { width: Math.round(width * r), height: Math.round(height * r) }
}

const UNREADABLE =
  '無法讀取這張圖片，可能是 HEIC 等手機不支援的格式。請改選 JPEG 或 PNG 圖片，或到 iPhone「設定 › 相機 › 格式」改成「最相容」。'

/** 解碼圖片並依照片的方向資訊（EXIF）轉正 */
async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bmp, width: bmp.width, height: bmp.height, done: () => bmp.close() }
    } catch {
      /* 某些瀏覽器不支援這個選項或格式，改用 <img> 再試一次 */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    // 現代瀏覽器的 <img> 會自動依 EXIF 轉正
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) }
  } catch {
    URL.revokeObjectURL(url)
    throw new AppError(UNREADABLE)
  }
}

/** 壓縮成 JPEG；透明背景補成白色 */
export async function compressImage(file: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  if (file.type && !file.type.startsWith('image/')) throw new AppError('請選擇圖片檔')
  const img = await decode(file)
  try {
    if (!img.width || !img.height) throw new AppError(UNREADABLE)
    const { width, height } = fitWithin(img.width, img.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new AppError('手機記憶體不足，無法處理這張圖片，請改選較小的圖片')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img.source, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob) throw new AppError('圖片壓縮失敗，請改選其他圖片')
    return { blob, width, height }
  } finally {
    img.done()
  }
}
