import type {
  S3CopyOptions,
  S3CreateFolderOptions,
  S3DeleteFilesOptions,
  S3DeleteFolderOptions,
  S3FileAttributes,
  S3FolderLock,
  S3GetFolderLockOptions,
  S3GetFileAttributesOptions,
  S3GetPreviewUrlOptions,
  S3ListOptions,
  S3MoveOptions,
  S3PrepareUploadsOptions,
  S3PreparedUpload,
  S3SearchOptions,
  S3SetFileAttributesOptions,
} from '../core/types'

import type {
  S3FileManagerClientHooks,
  S3FileManagerClientOptions,
  S3FileManagerClientListResult,
  S3FileManagerClientSearchResult,
  S3FileManagerClientPreviewResult,
} from './types'

function normalizeBasePath(basePath?: string): string {
  if (!basePath) return ''
  if (basePath === '/') return ''
  return basePath.startsWith('/')
    ? basePath.replace(/\/+$/, '')
    : `/${basePath.replace(/\/+$/, '')}`
}

function normalizeApiRootFromParts(baseUrl: string, basePath?: string): string {
  const b = baseUrl.replace(/\/+$/, '')
  const p = normalizeBasePath(basePath)
  return p ? `${b}${p}` : b
}

async function fetchJson<T>(f: typeof fetch, url: string, body: unknown): Promise<T> {
  const res = await f(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed: ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

function uploadWithXhr(
  upload: S3PreparedUpload,
  file: File,
  hooks?: S3FileManagerClientHooks,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(upload.method, upload.url)

    for (const [k, v] of Object.entries(upload.headers ?? {})) {
      xhr.setRequestHeader(k, v)
    }

    xhr.upload.onprogress = (evt) => {
      hooks?.onUploadProgress?.({
        path: upload.path,
        loaded: evt.loaded,
        total: evt.total,
      })
    }

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        await hooks?.onUploadComplete?.({ path: upload.path })
        resolve()
        return
      }

      const responseText = xhr.responseText ? ` - ${xhr.responseText.slice(0, 200)}` : ''
      const error = new Error(`Upload failed: ${xhr.status}${responseText}`)
      await hooks?.onUploadError?.({ path: upload.path, error })
      reject(error)
    }

    xhr.onerror = async () => {
      const error = new Error('Upload failed: network error')
      await hooks?.onUploadError?.({ path: upload.path, error })
      reject(error)
    }

    xhr.send(file)
  })
}

export class S3FileManagerClient {
  private readonly apiRoot: string
  private readonly f: typeof fetch

  constructor(options: S3FileManagerClientOptions) {
    this.apiRoot =
      'apiUrl' in options
        ? options.apiUrl.replace(/\/+$/, '')
        : normalizeApiRootFromParts(options.baseUrl, options.basePath)
    this.f = options.fetch ?? fetch
  }

  private endpoint(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`
    return `${this.apiRoot}${p}`
  }

  list(options: S3ListOptions): Promise<S3FileManagerClientListResult> {
    return fetchJson(this.f, this.endpoint('/list'), options)
  }

  search(options: S3SearchOptions): Promise<S3FileManagerClientSearchResult> {
    return fetchJson(this.f, this.endpoint('/search'), options)
  }

  createFolder(options: S3CreateFolderOptions): Promise<void> {
    return fetchJson(this.f, this.endpoint('/folder/create'), options)
  }

  deleteFolder(options: S3DeleteFolderOptions): Promise<void> {
    return fetchJson(this.f, this.endpoint('/folder/delete'), options)
  }

  deleteFiles(options: S3DeleteFilesOptions): Promise<void> {
    return fetchJson(this.f, this.endpoint('/files/delete'), options)
  }

  copy(options: S3CopyOptions): Promise<void> {
    return fetchJson(this.f, this.endpoint('/files/copy'), options)
  }

  move(options: S3MoveOptions): Promise<void> {
    return fetchJson(this.f, this.endpoint('/files/move'), options)
  }

  prepareUploads(options: S3PrepareUploadsOptions): Promise<S3PreparedUpload[]> {
    return fetchJson(this.f, this.endpoint('/upload/prepare'), options)
  }

  getPreviewUrl(options: S3GetPreviewUrlOptions): Promise<S3FileManagerClientPreviewResult> {
    return fetchJson(this.f, this.endpoint('/preview'), options)
  }

  getFolderLock(options: S3GetFolderLockOptions): Promise<S3FolderLock | null> {
    return fetchJson(this.f, this.endpoint('/folder/lock/get'), options)
  }

  getFileAttributes(options: S3GetFileAttributesOptions): Promise<S3FileAttributes> {
    return fetchJson(this.f, this.endpoint('/file/attributes/get'), options)
  }

  setFileAttributes(options: S3SetFileAttributesOptions): Promise<S3FileAttributes> {
    return fetchJson(this.f, this.endpoint('/file/attributes/set'), options)
  }

  async uploadFiles(args: {
    files: Array<{
      file: File
      path: string
      contentType?: string
      cacheControl?: string
      contentDisposition?: string
      metadata?: Record<string, string>
      expiresAt?: string | null
      ifNoneMatch?: string
    }>
    expiresInSeconds?: number
    hooks?: S3FileManagerClientHooks
    parallel?: number
  }): Promise<void> {
    const prepare: S3PrepareUploadsOptions = {
      items: args.files.map((f) => ({
        path: f.path,
        contentType: f.contentType ?? f.file.type,
        ...(f.cacheControl !== undefined ? { cacheControl: f.cacheControl } : {}),
        ...(f.contentDisposition !== undefined ? { contentDisposition: f.contentDisposition } : {}),
        ...(f.metadata !== undefined ? { metadata: f.metadata } : {}),
        ...(f.expiresAt !== undefined ? { expiresAt: f.expiresAt } : {}),
        ...(f.ifNoneMatch !== undefined ? { ifNoneMatch: f.ifNoneMatch } : {}),
      })),
      ...(args.expiresInSeconds !== undefined ? { expiresInSeconds: args.expiresInSeconds } : {}),
    }

    const uploads = await this.prepareUploads(prepare)

    const byPath = new Map(uploads.map((u) => [u.path, u] as const))

    const tasks = args.files.map(({ file, path }) => {
      const upload = byPath.get(path)
      if (!upload) throw new Error(`Missing presigned upload for: ${path}`)
      return () => uploadWithXhr(upload, file, args.hooks)
    })

    const parallel = Math.max(1, args.parallel ?? 4)
    let i = 0

    const runWorker = async () => {
      while (true) {
        const idx = i++
        if (idx >= tasks.length) return
        await tasks[idx]!()
      }
    }

    await Promise.all(Array.from({ length: Math.min(parallel, tasks.length) }, runWorker))
  }
}
