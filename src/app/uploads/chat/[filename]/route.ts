import { getReadableUploadDirs, getUploadPath, isSafeUploadFilename } from '@/lib/upload-storage'
import { readFile } from 'fs/promises'
import { lookup } from 'mime-types'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_request: NextRequest, props: { params: Promise<{ filename: string }> }) {
  const params = await props.params
  const filename = params.filename

  if (!isSafeUploadFilename(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
  }

  for (const uploadDir of getReadableUploadDirs('chat')) {
    try {
      const filePath = getUploadPath(uploadDir, filename)
      const fileBuffer = await readFile(filePath)

      const mimeType = lookup(filename) || 'application/octet-stream'

      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') {
        console.error('Error reading chat upload file:', error)
      }
    }
  }

  return NextResponse.json({ error: 'File not found' }, { status: 404 })
}
