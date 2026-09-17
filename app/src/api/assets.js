import { api } from './client.js'

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
const MAX_DIMENSION = 2048

/**
 * Downscale raster images that exceed MAX_DIMENSION on the client before upload.
 * GIFs and SVGs are passed through untouched (resizing would drop animation / vectors).
 */
export async function prepareImageFile(file) {
  if (!file.type.startsWith('image/')) return file
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file

  const bitmap = await loadImage(file)
  const { width, height } = bitmap
  if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) return file

  const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)

  const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, outType, 0.9))
  const name = file.name.replace(/\.[^.]+$/, '') + (outType === 'image/png' ? '.png' : '.jpg')
  return new File([blob], name, { type: outType })
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not decode image')) }
    img.src = url
  })
}

/**
 * Upload an image. Returns { id, url, width, height, mime }.
 */
export async function uploadAsset(file) {
  const prepared = await prepareImageFile(file)
  const form = new FormData()
  form.append('file', prepared, prepared.name)
  const res = await api('/api/assets', { method: 'POST', body: form })
  return res.asset
}

/** Read the natural dimensions of an image URL (used when adding images to the canvas). */
export function measureImage(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth || 800, height: img.naturalHeight || 600 })
    img.onerror = () => resolve({ width: 800, height: 600 })
    img.src = url
  })
}
