import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
// This SDK is a runtime dependency because configured S3 storage is initialized at startup.
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MENU_UPLOAD_DIR = path.join(__dirname, '../../uploads/menu')
const S3_BUCKET = process.env.AWS_BUCKET_NAME
const S3_REGION = process.env.AWS_REGION
const S3_PREFIX = (process.env.AWS_S3_UPLOAD_PREFIX || 'ruut_caffe').replace(/^\/+|\/+$/g, '')
const s3 = S3_BUCKET && S3_REGION ? new S3Client({ region: S3_REGION }) : null

function menuObjectKey(filename) {
  return `${S3_PREFIX}/menu/${filename}`
}

function getS3PublicUrl(key) {
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key.replace(/^\/+/, '')}`
}

function extractMenuS3Key(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string' || !S3_BUCKET) return null
  if (imageUrl.startsWith('/uploads/menu/')) return menuObjectKey(path.basename(imageUrl))
  try {
    const parsed = new URL(imageUrl)
    if (parsed.hostname === `${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com` || parsed.hostname === `${S3_BUCKET}.s3.amazonaws.com`) {
      return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
    }
  } catch {
    return null
  }
  return null
}

export async function ensureMenuUploadDir() {
  await fs.mkdir(MENU_UPLOAD_DIR, { recursive: true })
}

/** Save base64 menu image to S3 when configured, otherwise to local disk. */
export async function persistMenuImageUrl(imageUrl, itemId) {
  if (!imageUrl || typeof imageUrl !== 'string') return null
  if (imageUrl.startsWith('/uploads/menu/')) return imageUrl
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl
  if (!imageUrl.startsWith('data:image/')) return null

  const match = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/s)
  if (!match) return null

  const ext = match[1] === 'jpeg' ? 'jpg' : match[1]
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length > 2_500_000) return null

const fingerprint = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 12)
  const filename = `item-${itemId}-${fingerprint}.${ext}`

  if (!s3) throw new Error('S3 image storage is not configured')
  const key = menuObjectKey(filename)
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    CacheControl: 'public, max-age=31536000, immutable',
  }))
  return getS3PublicUrl(key)
}

/** Ensure DB/base64 images become a storable path. */
export async function resolveMenuItemImageUrl(imageUrl, itemId) {
  if (!imageUrl || typeof imageUrl !== 'string') return null
  if (imageUrl.startsWith('data:')) return persistMenuImageUrl(imageUrl, itemId)

  if (imageUrl.startsWith('/uploads/menu/')) {
    if (s3) return imageUrl
    const filepath = path.join(__dirname, '../../', imageUrl.replace(/^\//, ''))
    try {
      await fs.access(filepath)
      return imageUrl
    } catch {
      return null
    }
  }

  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl.length <= 600 ? imageUrl : null
  }
  return null
}

export function sanitizeMenuImageUrlForPos(url) {
  if (!url || typeof url !== 'string') return null
  if (url.startsWith('/uploads/')) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url.length <= 600 ? url : null
  return null
}

export function getApiPublicOrigin(req) {
  if (process.env.API_PUBLIC_URL) return process.env.API_PUBLIC_URL.replace(/\/$/, '')
  const host = req.get('host')
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'http'
  return `${protocol}://${host}`
}

export function toAbsoluteMenuImageUrl(url, origin) {
  if (!url || typeof url !== 'string') return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/uploads/')) return `${origin}${url}`
  return null
}

export async function deleteMenuImageFile(imageUrl) {
  const key = extractMenuS3Key(imageUrl)
  if (s3 && key) {
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key })).catch(() => {})
  }
  if (imageUrl?.startsWith('/uploads/menu/')) {
    const filepath = path.join(__dirname, '../../', imageUrl.replace(/^\//, ''))
    await fs.unlink(filepath).catch(() => {})
  }
}

/** Serve local images first, then private S3 objects. */
export async function serveMenuImage(req, res) {
  const filename = path.basename(String(req.params.filename || ''))
  if (!/^item-\d+(?:-[a-f0-9]{12})?\.(?:jpg|jpeg|png|webp|gif)$/i.test(filename)) return res.sendStatus(404)

  const localPath = path.join(MENU_UPLOAD_DIR, filename)
  try {
    await fs.access(localPath)
    return res.sendFile(localPath)
  } catch {
    // Production images may live only in S3.
  }

  if (!s3) return res.sendStatus(404)
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: menuObjectKey(filename) }))
    res.setHeader('Content-Type', object.ContentType || 'application/octet-stream')
    res.setHeader('Cache-Control', object.CacheControl || 'public, max-age=86400')
    if (object.ETag) res.setHeader('ETag', object.ETag)
    object.Body.pipe(res)
  } catch (error) {
    if (error?.name !== 'NoSuchKey') console.error('S3 menu image read failed:', error?.message)
    res.sendStatus(404)
  }
}

/** Copy existing local menu images to S3 without changing database paths. */
export async function migrateLocalMenuImagesToS3() {
  if (!s3) return { enabled: false, uploaded: 0 }
  await ensureMenuUploadDir()
  const filenames = (await fs.readdir(MENU_UPLOAD_DIR)).filter(name => /^item-\d+(?:-[a-f0-9]{12})?\.(?:jpg|jpeg|png|webp|gif)$/i.test(name))
  for (const filename of filenames) {
    const ext = path.extname(filename).slice(1).toLowerCase()
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: menuObjectKey(filename),
      Body: await fs.readFile(path.join(MENU_UPLOAD_DIR, filename)),
      ContentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      CacheControl: 'public, max-age=31536000, immutable',
    }))
  }
  return { enabled: true, uploaded: filenames.length }
}

export async function formatMenuItemImageForApi(imageUrl, itemId, origin) {
  const resolved = await resolveMenuItemImageUrl(imageUrl, itemId)
  return toAbsoluteMenuImageUrl(resolved, origin)
}
