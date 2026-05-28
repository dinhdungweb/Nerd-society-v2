import { constants } from 'fs'
import { access, mkdir } from 'fs/promises'
import os from 'os'
import path from 'path'

const DEFAULT_UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')
const FALLBACK_UPLOADS_DIR = path.join(os.tmpdir(), 'nerdsociety-uploads')

let cachedWritableUploadsDir: string | null = null

function uniquePaths(paths: string[]) {
  return Array.from(new Set(paths.map((dir) => path.resolve(dir))))
}

export function getConfiguredUploadsDir() {
  const envDir = process.env.UPLOAD_DIR || process.env.UPLOADS_DIR
  return path.resolve(envDir?.trim() || DEFAULT_UPLOADS_DIR)
}

export function getUploadPath(uploadRoot: string, filename: string, subdir?: string) {
  return path.join(uploadRoot, subdir || '', filename)
}

export function getUploadUrl(filename: string, subdir?: string) {
  return subdir ? `/uploads/${subdir}/${filename}` : `/uploads/${filename}`
}

export function isSafeUploadFilename(filename: string) {
  return /^[\w.-]+$/.test(filename)
}

export function getReadableUploadDirs(subdir?: string) {
  return uniquePaths([getConfiguredUploadsDir(), DEFAULT_UPLOADS_DIR, FALLBACK_UPLOADS_DIR]).map((dir) =>
    path.join(dir, subdir || '')
  )
}

export async function getWritableUploadsDir(subdir?: string) {
  if (cachedWritableUploadsDir) {
    const dir = path.join(cachedWritableUploadsDir, subdir || '')
    await mkdir(dir, { recursive: true })
    return dir
  }

  const candidates = uniquePaths([getConfiguredUploadsDir(), FALLBACK_UPLOADS_DIR])

  let lastError: unknown

  for (const candidate of candidates) {
    try {
      await mkdir(candidate, { recursive: true })
      await access(candidate, constants.W_OK)
      cachedWritableUploadsDir = candidate

      const dir = path.join(candidate, subdir || '')
      await mkdir(dir, { recursive: true })
      return dir
    } catch (error) {
      lastError = error
      console.warn(`Upload directory is not writable: ${candidate}`, error)
    }
  }

  throw lastError
}
