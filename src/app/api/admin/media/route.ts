import { canManage } from '@/lib/apiPermissions'
import { getReadableUploadDirs, getUploadPath, getUploadUrl, isSafeUploadFilename } from '@/lib/upload-storage'
import { readdir, stat, unlink } from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/admin/media - List all uploaded files
export async function GET() {
  try {
    const filesByName = new Map()

    for (const uploadDir of getReadableUploadDirs()) {
      let files: string[]

      try {
        files = await readdir(uploadDir)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.error('Error reading media directory:', uploadDir, error)
        }
        continue
      }

      for (const file of files) {
        if (file.startsWith('.') || !isSafeUploadFilename(file) || filesByName.has(file)) {
          continue
        }

        const filePath = getUploadPath(uploadDir, file)
        const stats = await stat(filePath)

        if (!stats.isFile()) {
          continue
        }

        const ext = file.split('.').pop()?.toLowerCase()
        const isImage = ext ? ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) : false

        filesByName.set(file, {
          name: file,
          url: getUploadUrl(file),
          size: stats.size,
          isImage,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
        })
      }
    }

    const fileDetails = Array.from(filesByName.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json({ files: fileDetails })
  } catch (error) {
    console.error('Error listing media:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE /api/admin/media - Delete a file (requires canManageGallery permission)
export async function DELETE(request: NextRequest) {
  try {
    const { session, hasAccess } = await canManage('Gallery')
    if (!session || !hasAccess) {
      return NextResponse.json({ error: 'Không có quyền xóa media' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filename = searchParams.get('filename')

    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 })
    }

    // Security: only allow alphanumeric, dash, underscore, dot
    if (!isSafeUploadFilename(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    for (const uploadDir of getReadableUploadDirs()) {
      const filePath = getUploadPath(uploadDir, filename)

      try {
        await unlink(filePath)
        return NextResponse.json({ success: true })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error
        }
      }
    }

    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  } catch (error) {
    console.error('Error deleting media:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
