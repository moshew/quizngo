import { uploadAsset, measureImage, MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES } from '../../api/assets.js'
import { assetUrl } from '../../api/client.js'
import { t } from '../../i18n/index.js'
import { toast } from '../../components/Toast.jsx'
import { getState, insertImage, updateElement, updateQuestion, setAnswer, setBackground, setQuestionMediaSrc } from '../../state/editorStore.js'

/** Center crop (fractions of the source) that fills a box of boxW×boxH with an imgW×imgH image. */
export function coverCrop(imgW, imgH, boxW, boxH) {
  const imgAspect = imgW / imgH
  const boxAspect = boxW / boxH
  if (imgAspect > boxAspect) {
    const w = boxAspect / imgAspect
    return { x: (1 - w) / 2, y: 0, w, h: 1 }
  }
  const h = imgAspect / boxAspect
  return { x: 0, y: (1 - h) / 2, w: 1, h }
}

function validate(file) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) { toast.error(t('editor.unsupportedFile')); return false }
  if (file.size > MAX_UPLOAD_BYTES) { toast.error(t('editor.fileTooLarge')); return false }
  return true
}

export async function uploadFile(file) {
  if (!validate(file)) return null
  try {
    const asset = await uploadAsset(file)
    return asset
  } catch (err) {
    toast.error(`${t('editor.uploadFailed')}: ${err.message === 'networkError' ? t('common.networkError') : err.message}`)
    return null
  }
}

export function pickFiles({ multiple = false, onFiles } = {}) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = ACCEPTED_IMAGE_TYPES.join(',')
  input.multiple = multiple
  input.style.display = 'none'
  input.onchange = () => {
    const files = Array.from(input.files || [])
    input.remove()
    if (!files.length) return
    if (onFiles) onFiles(files)
    else uploadAndInsert(files)
  }
  document.body.appendChild(input)
  input.click()
}

/** Upload files and add them as image elements (optionally centered at slide coords x,y). */
export async function uploadAndInsert(files, { x, y } = {}) {
  let offset = 0
  for (const file of files) {
    const asset = await uploadFile(file)
    if (!asset) continue
    const size = asset.width && asset.height ? { width: asset.width, height: asset.height } : await measureImage(assetUrl(asset.url))
    insertImage({ src: asset.url, width: size.width, height: size.height, x: x !== undefined ? x + offset : undefined, y: y !== undefined ? y + offset : undefined })
    offset += 40
  }
}

export async function addImagesFromUrl(url) {
  if (!/^https?:\/\//i.test(url)) { toast.error(t('editor.unsupportedFile')); return }
  const size = await measureImage(url)
  insertImage({ src: url, width: size.width, height: size.height })
}

/** Replace the picture of an existing image element, re-cropping to fill its box. */
export async function replaceElementImage(elementId, file) {
  const asset = await uploadFile(file)
  if (!asset) return
  const size = asset.width && asset.height ? { width: asset.width, height: asset.height } : await measureImage(assetUrl(asset.url))
  const slide = getState().quiz.slides.find((s) => s.id === getState().currentSlideId)
  const el = slide?.elements.find((e) => e.id === elementId)
  if (!el) return
  if (el.binding === 'question-media') {
    updateQuestion(slide.id, { media: { src: asset.url } }, null)
    updateElement(elementId, { crop: coverCrop(size.width, size.height, el.w, el.h), placeholder: false }, null)
    return
  }
  updateElement(elementId, { src: asset.url, crop: coverCrop(size.width, size.height, el.w, el.h), placeholder: false }, null)
}

export function pickForElement(elementId) {
  pickFiles({ onFiles: (files) => replaceElementImage(elementId, files[0]) })
}

/** Upload and set the question image; the store switches to an image layout when needed (FR-19). */
export async function setQuestionMedia(slideId, file) {
  const asset = await uploadFile(file)
  if (!asset) return
  setQuestionMediaSrc(slideId, asset.url)
}

export async function setAnswerImage(slideId, index, file) {
  const asset = await uploadFile(file)
  if (!asset) return
  setAnswer(slideId, index, { image: { src: asset.url } }, null)
}

export async function setBackgroundImage(slideId, file) {
  const asset = await uploadFile(file)
  if (!asset) return
  const slide = getState().quiz.slides.find((s) => s.id === slideId)
  // A photo background replaces the template's atmosphere rather than fighting it.
  setBackground(slideId, { kind: 'image', src: asset.url, overlay: slide?.background?.overlay || null, fit: 'cover', decor: false }, null)
}

export function useImageUpload() {
  return { pickFiles, uploadAndInsert, addImagesFromUrl, replaceElementImage, pickForElement, setQuestionMedia, setAnswerImage, setBackgroundImage, uploadFile }
}
