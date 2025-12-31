function splitName(name: string): { base: string; ext: string } {
  const idx = name.lastIndexOf('.')
  if (idx <= 0) return { base: name, ext: '' }
  return { base: name.slice(0, idx), ext: name.slice(idx) }
}

export function buildUniqueName(name: string, existing: Set<string>): string {
  if (!existing.has(name)) return name
  const { base, ext } = splitName(name)
  let i = 1
  while (true) {
    const candidate = `${base}_copy_${i}${ext}`
    if (!existing.has(candidate)) return candidate
    i += 1
  }
}
