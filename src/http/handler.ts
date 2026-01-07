import type { S3FileManager } from '../core/manager'
import { S3FileManagerAuthorizationError, S3FileManagerConflictError } from '../core/errors'
import type { S3FileManagerAuthContext } from '../core/types'
import type { HttpRequest, HttpResponse, S3FileManagerApiOptions } from './types'

class S3FileManagerHttpError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function normalizeBasePath(basePath?: string): string {
  if (!basePath) return ''
  if (basePath === '/') return ''
  return basePath.startsWith('/')
    ? basePath.replace(/\/+$/, '')
    : `/${basePath.replace(/\/+$/, '')}`
}

function jsonError(status: number, code: string, message: string): HttpResponse {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    body: {
      error: {
        code,
        message,
      },
    },
  }
}

function ensureObject(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object' && !Array.isArray(body))
    return body as Record<string, unknown>
  throw new S3FileManagerHttpError(400, 'invalid_body', 'Expected JSON object body')
}

function optionalString(value: unknown, key: string): string | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'string') return value
  throw new S3FileManagerHttpError(400, 'invalid_body', `Expected '${key}' to be a string`)
}

function optionalStringOrNull(value: unknown, key: string): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === 'string') return value
  throw new S3FileManagerHttpError(400, 'invalid_body', `Expected '${key}' to be a string`)
}

function optionalDateStringOrNull(value: unknown, key: string): string | null | undefined {
  const raw = optionalStringOrNull(value, key)
  if (raw === undefined || raw === null) return raw
  const parsed = new Date(raw)
  if (!Number.isFinite(parsed.getTime())) {
    throw new S3FileManagerHttpError(400, 'invalid_body', `Expected '${key}' to be a date string`)
  }
  return raw
}

function requiredString(value: unknown, key: string): string {
  if (typeof value === 'string') return value
  throw new S3FileManagerHttpError(400, 'invalid_body', `Expected '${key}' to be a string`)
}

function optionalNumber(value: unknown, key: string): number | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'number' && Number.isFinite(value)) return value
  throw new S3FileManagerHttpError(400, 'invalid_body', `Expected '${key}' to be a finite number`)
}

function optionalBoolean(value: unknown, key: string): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'boolean') return value
  throw new S3FileManagerHttpError(400, 'invalid_body', `Expected '${key}' to be a boolean`)
}

function requiredStringArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value)) {
    throw new S3FileManagerHttpError(
      400,
      'invalid_body',
      `Expected '${key}' to be an array of strings`,
    )
  }
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new S3FileManagerHttpError(
        400,
        'invalid_body',
        `Expected '${key}' to be an array of strings`,
      )
    }
  }
  return value
}

function optionalStringRecord(value: unknown, key: string): Record<string, string> | undefined {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new S3FileManagerHttpError(
      400,
      'invalid_body',
      `Expected '${key}' to be an object of strings`,
    )
  }
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value)) {
    if (typeof v !== 'string') {
      throw new S3FileManagerHttpError(400, 'invalid_body', `Expected '${key}.${k}' to be a string`)
    }
    out[k] = v
  }
  return out
}

function parseListOptions(body: unknown) {
  const obj = ensureObject(body)
  return {
    path: requiredString(obj.path, 'path'),
    cursor: optionalString(obj.cursor, 'cursor'),
    limit: optionalNumber(obj.limit, 'limit'),
  }
}

function parseSearchOptions(body: unknown) {
  const obj = ensureObject(body)
  return {
    query: requiredString(obj.query, 'query'),
    path: optionalString(obj.path, 'path'),
    recursive: optionalBoolean(obj.recursive, 'recursive'),
    limit: optionalNumber(obj.limit, 'limit'),
    cursor: optionalString(obj.cursor, 'cursor'),
  }
}

function parseCreateFolderOptions(body: unknown) {
  const obj = ensureObject(body)
  return { path: requiredString(obj.path, 'path') }
}

function parseDeleteFolderOptions(body: unknown) {
  const obj = ensureObject(body)
  return {
    path: requiredString(obj.path, 'path'),
    recursive: optionalBoolean(obj.recursive, 'recursive'),
  }
}

function parseDeleteFilesOptions(body: unknown) {
  const obj = ensureObject(body)
  const itemsValue = obj.items
  const items = Array.isArray(itemsValue)
    ? itemsValue.map((raw, idx) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          throw new S3FileManagerHttpError(
            400,
            'invalid_body',
            `Expected 'items[${idx}]' to be an object`,
          )
        }
        const item = raw as Record<string, unknown>
        return {
          path: requiredString(item.path, `items[${idx}].path`),
          ifMatch: optionalString(item.ifMatch, `items[${idx}].ifMatch`),
          ifNoneMatch: optionalString(item.ifNoneMatch, `items[${idx}].ifNoneMatch`),
        }
      })
    : undefined

  const paths = obj.paths !== undefined ? requiredStringArray(obj.paths, 'paths') : undefined

  if (!paths && !items) {
    throw new S3FileManagerHttpError(
      400,
      'invalid_body',
      "Expected 'paths' or 'items' to be provided",
    )
  }

  return { ...(paths ? { paths } : {}), ...(items ? { items } : {}) }
}

function parseCopyMoveOptions(body: unknown) {
  const obj = ensureObject(body)
  return {
    fromPath: requiredString(obj.fromPath, 'fromPath'),
    toPath: requiredString(obj.toPath, 'toPath'),
    ifMatch: optionalString(obj.ifMatch, 'ifMatch'),
  }
}

function parsePrepareUploadsOptions(body: unknown) {
  const obj = ensureObject(body)
  const itemsValue = obj.items
  if (!Array.isArray(itemsValue)) {
    throw new S3FileManagerHttpError(400, 'invalid_body', "Expected 'items' to be an array")
  }

  const items = itemsValue.map((raw, idx) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new S3FileManagerHttpError(
        400,
        'invalid_body',
        `Expected 'items[${idx}]' to be an object`,
      )
    }
    const item = raw as Record<string, unknown>
    return {
      path: requiredString(item.path, `items[${idx}].path`),
      contentType: optionalString(item.contentType, `items[${idx}].contentType`),
      cacheControl: optionalString(item.cacheControl, `items[${idx}].cacheControl`),
      contentDisposition: optionalString(
        item.contentDisposition,
        `items[${idx}].contentDisposition`,
      ),
      metadata: optionalStringRecord(item.metadata, `items[${idx}].metadata`),
      expiresAt: optionalDateStringOrNull(item.expiresAt, `items[${idx}].expiresAt`),
      ifNoneMatch: optionalString(item.ifNoneMatch, `items[${idx}].ifNoneMatch`),
    }
  })

  return {
    items,
    expiresInSeconds: optionalNumber(obj.expiresInSeconds, 'expiresInSeconds'),
  }
}

function parsePreviewOptions(body: unknown) {
  const obj = ensureObject(body)
  return {
    path: requiredString(obj.path, 'path'),
    expiresInSeconds: optionalNumber(obj.expiresInSeconds, 'expiresInSeconds'),
    inline: optionalBoolean(obj.inline, 'inline'),
  }
}

function parseGetFolderLockOptions(body: unknown) {
  const obj = ensureObject(body)
  return {
    path: requiredString(obj.path, 'path'),
  }
}

function parseGetFileAttributesOptions(body: unknown) {
  const obj = ensureObject(body)
  return {
    path: requiredString(obj.path, 'path'),
  }
}

function parseSetFileAttributesOptions(body: unknown) {
  const obj = ensureObject(body)
  return {
    path: requiredString(obj.path, 'path'),
    contentType: optionalString(obj.contentType, 'contentType'),
    cacheControl: optionalString(obj.cacheControl, 'cacheControl'),
    contentDisposition: optionalString(obj.contentDisposition, 'contentDisposition'),
    metadata: optionalStringRecord(obj.metadata, 'metadata'),
    expiresAt: optionalDateStringOrNull(obj.expiresAt, 'expiresAt'),
    ifMatch: optionalString(obj.ifMatch, 'ifMatch'),
  }
}

export interface CreateS3FileManagerHttpHandlerOptions<FileExtra, FolderExtra> {
  manager?: S3FileManager<FileExtra, FolderExtra>
  getManager?: (
    req: HttpRequest,
    ctx: S3FileManagerAuthContext,
  ) => S3FileManager<FileExtra, FolderExtra> | Promise<S3FileManager<FileExtra, FolderExtra>>
  getContext?: (req: HttpRequest) => Promise<S3FileManagerAuthContext> | S3FileManagerAuthContext
  api?: S3FileManagerApiOptions
}

export function createS3FileManagerHttpHandler<FileExtra = unknown, FolderExtra = unknown>(
  options: CreateS3FileManagerHttpHandlerOptions<FileExtra, FolderExtra>,
): (req: HttpRequest) => Promise<HttpResponse> {
  const basePath = normalizeBasePath(options.api?.basePath)

  if (!options.manager && !options.getManager) {
    throw new Error('createS3FileManagerHttpHandler requires either manager or getManager')
  }

  return async (req: HttpRequest): Promise<HttpResponse> => {
    try {
      const ctx = (await options.getContext?.(req)) ?? {}
      const manager = options.getManager ? await options.getManager(req, ctx) : options.manager!
      const method = req.method.toUpperCase()
      const path = req.path.startsWith(basePath) ? req.path.slice(basePath.length) || '/' : req.path

      if (method === 'POST' && path === '/list') {
        const out = await manager.list(parseListOptions(req.body) as any, ctx)
        return { status: 200, headers: { 'content-type': 'application/json' }, body: out as any }
      }

      if (method === 'POST' && path === '/search') {
        const out = await manager.search(parseSearchOptions(req.body) as any, ctx)
        return { status: 200, headers: { 'content-type': 'application/json' }, body: out as any }
      }

      if (method === 'POST' && path === '/folder/create') {
        await manager.createFolder(parseCreateFolderOptions(req.body) as any, ctx)
        return { status: 204 }
      }

      if (method === 'POST' && path === '/folder/delete') {
        await manager.deleteFolder(parseDeleteFolderOptions(req.body) as any, ctx)
        return { status: 204 }
      }

      if (method === 'POST' && path === '/files/delete') {
        await manager.deleteFiles(parseDeleteFilesOptions(req.body) as any, ctx)
        return { status: 204 }
      }

      if (method === 'POST' && path === '/files/copy') {
        await manager.copy(parseCopyMoveOptions(req.body) as any, ctx)
        return { status: 204 }
      }

      if (method === 'POST' && path === '/files/move') {
        await manager.move(parseCopyMoveOptions(req.body) as any, ctx)
        return { status: 204 }
      }

      if (method === 'POST' && path === '/upload/prepare') {
        const out = await manager.prepareUploads(parsePrepareUploadsOptions(req.body) as any, ctx)
        return { status: 200, headers: { 'content-type': 'application/json' }, body: out as any }
      }

      if (method === 'POST' && path === '/preview') {
        const out = await manager.getPreviewUrl(parsePreviewOptions(req.body) as any, ctx)
        return { status: 200, headers: { 'content-type': 'application/json' }, body: out as any }
      }

      if (method === 'POST' && path === '/folder/lock/get') {
        const out = await manager.getFolderLock(parseGetFolderLockOptions(req.body) as any, ctx)
        return { status: 200, headers: { 'content-type': 'application/json' }, body: out as any }
      }

      if (method === 'POST' && path === '/file/attributes/get') {
        const out = await manager.getFileAttributes(
          parseGetFileAttributesOptions(req.body) as any,
          ctx,
        )
        return { status: 200, headers: { 'content-type': 'application/json' }, body: out as any }
      }

      if (method === 'POST' && path === '/file/attributes/set') {
        const out = await manager.setFileAttributes(
          parseSetFileAttributesOptions(req.body) as any,
          ctx,
        )
        return { status: 200, headers: { 'content-type': 'application/json' }, body: out as any }
      }

      return jsonError(404, 'not_found', 'Route not found')
    } catch (err) {
      if (err instanceof S3FileManagerHttpError) {
        return jsonError(err.status, err.code, err.message)
      }
      if (err instanceof S3FileManagerAuthorizationError) {
        return jsonError(err.status, err.code, err.message)
      }
      if (err instanceof S3FileManagerConflictError) {
        return jsonError(err.status, err.code, err.message)
      }

      console.error('[S3FileManager Error]', err)
      const message = err instanceof Error ? err.message : 'Unknown error'
      return jsonError(500, 'internal_error', message)
    }
  }
}
