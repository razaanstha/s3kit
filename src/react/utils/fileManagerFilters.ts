const MIME_EXTENSION_MAP: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'image/svg+xml': ['svg'],
  'image/heic': ['heic'],
  'image/heif': ['heif'],
  'image/avif': ['avif'],
  'application/pdf': ['pdf'],
  'text/plain': ['txt'],
  'text/markdown': ['md'],
  'text/csv': ['csv'],
  'application/json': ['json'],
  'application/zip': ['zip'],
  'application/x-zip-compressed': ['zip'],
  'audio/mpeg': ['mp3'],
  'audio/wav': ['wav'],
  'audio/ogg': ['ogg'],
  'video/mp4': ['mp4'],
  'video/webm': ['webm'],
  'video/quicktime': ['mov'],
}

export function buildAllowedExtensions(
  extensions?: string[],
  mimeTypes?: string[],
): Set<string> | null {
  const allowed = new Set<string>()
  if (extensions) {
    for (const ext of extensions) {
      const trimmed = ext.replace(/^\./, '').toLowerCase()
      if (trimmed) allowed.add(trimmed)
    }
  }
  if (mimeTypes) {
    for (const type of mimeTypes) {
      const exts = MIME_EXTENSION_MAP[type.toLowerCase()] ?? []
      for (const ext of exts) allowed.add(ext)
    }
  }
  return allowed.size > 0 ? allowed : null
}

export function isImageFileName(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase()
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')
}
