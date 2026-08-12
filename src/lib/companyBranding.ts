export const DEFAULT_COMPANY_NAME = 'Company'

export const MAX_LOGO_BYTES = 150 * 1024
export const MAX_LOGO_HEIGHT_PX = 128

export function resolveCompanyName(
  stored: string | undefined,
  settings: string | undefined,
): string {
  const fromSettings = settings?.trim()
  const fromStored = stored?.trim()
  if (fromStored && fromStored !== DEFAULT_COMPANY_NAME) return fromStored
  if (fromSettings) return fromSettings
  return DEFAULT_COMPANY_NAME
}

export function resolveCompanyField(
  stored: string | undefined,
  settings: string | undefined,
): string {
  const fromStored = stored?.trim()
  if (fromStored) return fromStored
  return settings?.trim() ?? ''
}

export function resolveShowLogo(
  stored: boolean | undefined,
  settings: boolean | undefined,
  hasLogo: boolean,
): boolean {
  if (stored !== undefined) return stored
  if (settings !== undefined) return settings
  return hasLogo
}

export function resolveLogoDataUrl(
  stored: string | undefined,
  settings: string | undefined,
  showLogo: boolean,
): string | undefined {
  if (!showLogo) return undefined
  const fromStored = stored?.trim()
  if (fromStored) return fromStored
  const fromSettings = settings?.trim()
  return fromSettings || undefined
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function dataUrlByteLength(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? ''
  return Math.ceil((base64.length * 3) / 4)
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Invalid image file'))
    img.src = dataUrl
  })
}

function canvasToDataUrl(canvas: HTMLCanvasElement, type: string, quality: number): string {
  return canvas.toDataURL(type, quality)
}

async function resizeToDataUrl(dataUrl: string, mimeType: string): Promise<string> {
  const img = await loadImage(dataUrl)
  const scale = Math.min(1, MAX_LOGO_HEIGHT_PX / img.height)
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(img, 0, 0, width, height)

  const outputType = mimeType === 'image/png' ? 'image/png' : 'image/jpeg'
  let quality = 0.92
  let result = canvasToDataUrl(canvas, outputType, quality)
  while (dataUrlByteLength(result) > MAX_LOGO_BYTES && quality > 0.4) {
    quality -= 0.1
    result = canvasToDataUrl(canvas, outputType, quality)
  }
  if (dataUrlByteLength(result) > MAX_LOGO_BYTES) {
    throw new Error('Logo is too large after compression. Use a smaller image.')
  }
  return result
}

export async function compressLogoFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.')
  }

  const dataUrl = await readFileAsDataUrl(file)

  if (file.type === 'image/svg+xml') {
    if (dataUrlByteLength(dataUrl) > MAX_LOGO_BYTES) {
      throw new Error('SVG logo must be under 150KB.')
    }
    return dataUrl
  }

  return resizeToDataUrl(dataUrl, file.type)
}
