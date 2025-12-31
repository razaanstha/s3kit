export function joinPath(folder: string, name: string): string {
  const f = folder.replace(/\/+$/, '')
  if (!f) return name
  return `${f}/${name}`
}

export function normalizeRelativePath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\\/g, '/')
}

export function getRelativePathFromFile(file: File): string | null {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  if (!rel) return null
  return normalizeRelativePath(rel)
}

export function getParentPath(path: string): string {
  const p = path.replace(/\/+$/, '')
  const parts = p.split('/').filter(Boolean)
  parts.pop()
  return parts.join('/')
}
