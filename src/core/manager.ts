import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import type {
  S3CopyOptions,
  S3CreateFolderOptions,
  S3DeleteFilesOptions,
  S3DeleteFolderOptions,
  S3FileEntry,
  S3FileManagerAuthContext,
  S3FileManagerAuthorizationMode,
  S3FileManagerHooks,
  S3FileManagerOptions,
  S3FolderEntry,
  S3GetPreviewUrlOptions,
  S3GetPreviewUrlResult,
  S3ListOptions,
  S3ListResult,
  S3MoveOptions,
  S3PrepareUploadsOptions,
  S3PreparedUpload,
  S3SearchOptions,
  S3SearchResult,
} from './types'
import { S3FileManagerAuthorizationError } from './errors'

const DEFAULT_DELIMITER = '/'

function trimSlashes(input: string): string {
  return input.replace(/^\/+/, '').replace(/\/+$/, '')
}

function normalizePath(input: string): string {
  const raw = input.replace(/\\/g, '/')
  const noLeading = raw.replace(/^\/+/, '')
  const segments = noLeading.split('/').filter((s) => s.length > 0)
  for (const seg of segments) {
    if (seg === '..') {
      throw new Error('Invalid path')
    }
  }
  return segments.join('/')
}

function ensureTrailingDelimiter(prefix: string, delimiter: string): string {
  if (prefix === '') return ''
  return prefix.endsWith(delimiter) ? prefix : `${prefix}${delimiter}`
}

function encodeS3CopySource(bucket: string, key: string): string {
  return encodeURIComponent(`${bucket}/${key}`).replace(/%2F/g, '/')
}

function isNoSuchKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  if ('name' in err && err.name === 'NoSuchKey') return true
  if ('message' in err && typeof err.message === 'string') {
    return err.message.includes('The specified key does not exist')
  }
  return false
}

async function* listAllKeys(
  s3: S3Client,
  bucket: string,
  prefix: string,
): AsyncGenerator<string, void, void> {
  let cursor: string | undefined
  while (true) {
    const out = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: cursor,
      }),
    )

    for (const obj of out.Contents ?? []) {
      if (obj.Key) yield obj.Key
    }

    if (!out.IsTruncated) break
    cursor = out.NextContinuationToken
  }
}

async function deleteKeysInBatches(s3: S3Client, bucket: string, keys: string[]): Promise<void> {
  const batchSize = 1000
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize)
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    )
  }
}

export class S3FileManager<FileExtra = unknown, FolderExtra = unknown> {
  private readonly s3: S3Client
  private readonly bucket: string
  private readonly rootPrefix: string
  private readonly delimiter: string
  private readonly hooks: S3FileManagerHooks<FileExtra, FolderExtra> | undefined
  private readonly authorizationMode: S3FileManagerAuthorizationMode

  constructor(s3: S3Client, options: S3FileManagerOptions<FileExtra, FolderExtra>) {
    this.s3 = s3
    this.bucket = options.bucket
    this.delimiter = options.delimiter ?? DEFAULT_DELIMITER
    this.rootPrefix = ensureTrailingDelimiter(trimSlashes(options.rootPrefix ?? ''), this.delimiter)
    this.hooks = options.hooks
    this.authorizationMode = options.authorizationMode ?? 'deny-by-default'
  }

  private async authorize(
    args: Parameters<NonNullable<S3FileManagerHooks['authorize']>>[0],
  ): Promise<void> {
    const hasAuthHooks = Boolean(this.hooks?.authorize || this.hooks?.allowAction)

    if (this.hooks?.authorize) {
      const result = await this.hooks.authorize(args)
      if (result === false) {
        throw new S3FileManagerAuthorizationError('Unauthorized', 401, 'unauthorized')
      }
    }

    if (this.hooks?.allowAction) {
      const allowed = await this.hooks.allowAction(args)
      if (allowed === false) {
        throw new S3FileManagerAuthorizationError('Forbidden', 403, 'forbidden')
      }
    }

    if (!hasAuthHooks && this.authorizationMode === 'deny-by-default') {
      throw new S3FileManagerAuthorizationError('Unauthorized', 401, 'unauthorized')
    }
  }

  private pathToKey(path: string): string {
    const p = normalizePath(path)
    return `${this.rootPrefix}${p}`
  }

  private pathToFolderPrefix(path: string): string {
    const key = this.pathToKey(path)
    return ensureTrailingDelimiter(key, this.delimiter)
  }

  private keyToPath(key: string): string {
    if (!key.startsWith(this.rootPrefix)) {
      throw new Error('Key is outside of rootPrefix')
    }
    return key.slice(this.rootPrefix.length)
  }

  private makeFolderEntry(path: string): S3FolderEntry<FolderExtra> {
    const p = normalizePath(path)
    const name = p === '' ? '' : (p.split('/').at(-1) ?? '')
    return {
      type: 'folder',
      path: p === '' ? '' : ensureTrailingDelimiter(p, this.delimiter),
      name,
    }
  }

  private makeFileEntryFromKey(
    key: string,
    obj: {
      Size?: number
      LastModified?: Date
      ETag?: string
    },
  ): S3FileEntry<FileExtra> {
    const path = this.keyToPath(key)
    const name = path.split('/').at(-1) ?? ''
    return {
      type: 'file',
      path,
      name,
      ...(obj.Size !== undefined ? { size: obj.Size } : {}),
      ...(obj.LastModified ? { lastModified: obj.LastModified.toISOString() } : {}),
      ...(obj.ETag !== undefined ? { etag: obj.ETag } : {}),
    }
  }

  async list(
    options: S3ListOptions,
    ctx: S3FileManagerAuthContext = {},
  ): Promise<S3ListResult<FileExtra, FolderExtra>> {
    const path = normalizePath(options.path)
    await this.authorize({ action: 'list', path, ctx })

    const prefix = path === '' ? this.rootPrefix : this.pathToFolderPrefix(path)

    const out = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        Delimiter: this.delimiter,
        ContinuationToken: options.cursor,
        MaxKeys: options.limit,
      }),
    )

    const folders: Array<S3FolderEntry<FolderExtra>> = (
      (out.CommonPrefixes ?? []) as Array<{ Prefix?: string }>
    )
      .map((cp: { Prefix?: string }) => cp.Prefix)
      .filter((p: string | undefined): p is string => typeof p === 'string')
      .map((p: string) => {
        const rel = this.keyToPath(p)
        const folderPath = ensureTrailingDelimiter(trimSlashes(rel), this.delimiter)
        return this.makeFolderEntry(folderPath)
      })

    const files: Array<S3FileEntry<FileExtra>> = (
      (out.Contents ?? []) as Array<{
        Key?: string
        Size?: number
        LastModified?: Date
        ETag?: string
      }>
    )
      .filter((obj: { Key?: string }) => typeof obj.Key === 'string')
      .filter((obj: { Key?: string }) => obj.Key !== prefix)
      .map((obj) => this.makeFileEntryFromKey(obj.Key as string, obj))

    for (const folder of folders) {
      await this.hooks?.decorateFolder?.(folder, {
        path: folder.path,
        prefix: this.pathToFolderPrefix(folder.path),
      })
    }

    for (const file of files) {
      await this.hooks?.decorateFile?.(file, {
        path: file.path,
        key: this.pathToKey(file.path),
      })
    }

    const entries = [...folders, ...files].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    return {
      path,
      entries,
      ...(out.IsTruncated && out.NextContinuationToken
        ? { nextCursor: out.NextContinuationToken }
        : {}),
    }
  }

  async createFolder(
    options: S3CreateFolderOptions,
    ctx: S3FileManagerAuthContext = {},
  ): Promise<void> {
    const path = ensureTrailingDelimiter(normalizePath(options.path), this.delimiter)
    await this.authorize({ action: 'folder.create', path, ctx })

    const key = this.pathToFolderPrefix(path)
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: '',
      }),
    )
  }

  async deleteFolder(
    options: S3DeleteFolderOptions,
    ctx: S3FileManagerAuthContext = {},
  ): Promise<void> {
    const path = ensureTrailingDelimiter(normalizePath(options.path), this.delimiter)
    await this.authorize({ action: 'folder.delete', path, ctx })

    const prefix = this.pathToFolderPrefix(path)

    if (!options.recursive) {
      const out = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          MaxKeys: 2,
        }),
      )

      const keys = ((out.Contents ?? []) as Array<{ Key?: string }>)
        .map((o: { Key?: string }) => o.Key)
        .filter((k: string | undefined): k is string => typeof k === 'string' && k !== prefix)

      if (keys.length > 0) {
        throw new Error('Folder is not empty')
      }

      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: prefix }))
      return
    }

    const keys: string[] = []
    for await (const key of listAllKeys(this.s3, this.bucket, prefix)) {
      keys.push(key)
    }

    if (keys.length === 0) return
    await deleteKeysInBatches(this.s3, this.bucket, keys)
  }

  async deleteFiles(
    options: S3DeleteFilesOptions,
    ctx: S3FileManagerAuthContext = {},
  ): Promise<void> {
    const paths = options.paths.map((p) => normalizePath(p))
    for (const path of paths) {
      await this.authorize({ action: 'file.delete', path, ctx })
    }

    const keys = paths.map((p) => this.pathToKey(p))
    await deleteKeysInBatches(this.s3, this.bucket, keys)
  }

  async copy(options: S3CopyOptions, ctx: S3FileManagerAuthContext = {}): Promise<void> {
    const isFolder = options.fromPath.endsWith(this.delimiter)
    const fromPath = normalizePath(options.fromPath)
    const toPath = normalizePath(options.toPath)
    if (fromPath === toPath) return

    if (isFolder) {
      const fromPathWithSlash = ensureTrailingDelimiter(fromPath, this.delimiter)
      const toPathWithSlash = ensureTrailingDelimiter(toPath, this.delimiter)

      await this.authorize({
        action: 'folder.copy',
        fromPath: fromPathWithSlash,
        toPath: toPathWithSlash,
        ctx,
      })

      const fromPrefix = this.pathToFolderPrefix(fromPathWithSlash)
      const toPrefix = this.pathToFolderPrefix(toPathWithSlash)

      // Try copying the folder object itself
      try {
        await this.s3.send(
          new CopyObjectCommand({
            Bucket: this.bucket,
            Key: toPrefix,
            CopySource: encodeS3CopySource(this.bucket, fromPrefix),
          }),
        )
      } catch {
        // Ignore errors if the source folder object doesn't exist
      }

      // Copy all children
      for await (const sourceKey of listAllKeys(this.s3, this.bucket, fromPrefix)) {
        if (sourceKey === fromPrefix) continue

        const relKey = sourceKey.slice(fromPrefix.length)
        const destKey = toPrefix + relKey

        try {
          await this.s3.send(
            new CopyObjectCommand({
              Bucket: this.bucket,
              Key: destKey,
              CopySource: encodeS3CopySource(this.bucket, sourceKey),
            }),
          )
        } catch (err) {
          if (isNoSuchKeyError(err)) continue
          throw err
        }
      }
      return
    }

    await this.authorize({ action: 'file.copy', fromPath, toPath, ctx })

    const fromKey = this.pathToKey(fromPath)
    const toKey = this.pathToKey(toPath)

    await this.s3.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: toKey,
        CopySource: encodeS3CopySource(this.bucket, fromKey),
      }),
    )
  }

  async move(options: S3MoveOptions, ctx: S3FileManagerAuthContext = {}): Promise<void> {
    const isFolder = options.fromPath.endsWith(this.delimiter)
    const fromPath = normalizePath(options.fromPath)
    const toPath = normalizePath(options.toPath)
    if (fromPath === toPath) return

    if (isFolder) {
      const fromPathWithSlash = ensureTrailingDelimiter(fromPath, this.delimiter)
      const toPathWithSlash = ensureTrailingDelimiter(toPath, this.delimiter)

      await this.authorize({
        action: 'folder.move',
        fromPath: fromPathWithSlash,
        toPath: toPathWithSlash,
        ctx,
      })

      // Delegate to copy (handles recursion)
      await this.copy(options, ctx)

      // Delete original folder recursively
      await this.deleteFolder({ path: fromPathWithSlash, recursive: true }, ctx)
      return
    }

    await this.authorize({ action: 'file.move', fromPath, toPath, ctx })

    await this.copy(options, ctx)
    await this.deleteFiles({ paths: [fromPath] }, ctx)
  }

  async prepareUploads(
    options: S3PrepareUploadsOptions,
    ctx: S3FileManagerAuthContext = {},
  ): Promise<S3PreparedUpload[]> {
    const expiresIn = options.expiresInSeconds ?? 60 * 5

    const result: S3PreparedUpload[] = []

    for (const item of options.items) {
      const path = normalizePath(item.path)
      await this.authorize({ action: 'upload.prepare', path, ctx })

      const key = this.pathToKey(path)

      const cmd = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: item.contentType,
        CacheControl: item.cacheControl,
        ContentDisposition: item.contentDisposition,
        Metadata: item.metadata,
      })

      const url = await getSignedUrl(this.s3, cmd, { expiresIn })
      const headers: Record<string, string> = {}
      if (item.contentType) headers['Content-Type'] = item.contentType
      if (item.cacheControl) headers['Cache-Control'] = item.cacheControl
      if (item.contentDisposition) headers['Content-Disposition'] = item.contentDisposition
      if (item.metadata) {
        for (const [k, v] of Object.entries(item.metadata)) {
          headers[`x-amz-meta-${k}`] = v
        }
      }

      result.push({
        path,
        url,
        method: 'PUT',
        headers,
      })
    }

    return result
  }

  async search(
    options: S3SearchOptions,
    ctx: S3FileManagerAuthContext = {},
  ): Promise<S3SearchResult<FileExtra, FolderExtra>> {
    const query = options.query.toLowerCase().trim()
    if (!query) {
      return { query: options.query, entries: [] }
    }

    await this.authorize({ action: 'search', ctx })

    const searchPrefix = options.path
      ? this.pathToFolderPrefix(normalizePath(options.path))
      : this.rootPrefix

    const entries: Array<S3FileEntry<FileExtra>> = []

    // Search through objects (cursor is the underlying S3 continuation token).
    // Results are returned in the natural S3 listing order (lexicographic by key),
    // which keeps pagination stable.
    const limit = options.limit ?? 500
    const recursive = options.recursive !== false
    let cursor: string | undefined = options.cursor
    let nextCursor: string | undefined

    while (entries.length < limit) {
      const out = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: searchPrefix,
          ContinuationToken: cursor,
          MaxKeys: 1000, // Fetch more to filter
        }),
      )

      nextCursor =
        out.IsTruncated && out.NextContinuationToken ? out.NextContinuationToken : undefined

      // Process files
      for (const obj of out.Contents ?? []) {
        if (!obj.Key || obj.Key === searchPrefix) continue

        const path = this.keyToPath(obj.Key)
        const name = path.split('/').at(-1) ?? ''

        if (!recursive && options.path) {
          const base = ensureTrailingDelimiter(normalizePath(options.path), this.delimiter)
          const rel = path.startsWith(base) ? path.slice(base.length) : path
          if (rel.includes(this.delimiter)) continue
        }

        if (!recursive && !options.path) {
          if (path.includes(this.delimiter)) continue
        }

        // Check if file name matches search query
        if (name.toLowerCase().includes(query)) {
          const fileEntry = this.makeFileEntryFromKey(obj.Key, {
            ...(obj.Size !== undefined ? { Size: obj.Size } : {}),
            ...(obj.LastModified !== undefined ? { LastModified: obj.LastModified } : {}),
            ...(obj.ETag !== undefined ? { ETag: obj.ETag } : {}),
          })
          await this.hooks?.decorateFile?.(fileEntry, {
            path: fileEntry.path,
            key: this.pathToKey(fileEntry.path),
          })
          entries.push(fileEntry)
        }

        if (entries.length >= limit) break
      }

      if (!out.IsTruncated || !out.NextContinuationToken) break
      cursor = out.NextContinuationToken
    }

    return {
      query: options.query,
      entries,
      ...(nextCursor ? { nextCursor } : {}),
    }
  }

  async getPreviewUrl(
    options: S3GetPreviewUrlOptions,
    ctx: S3FileManagerAuthContext = {},
  ): Promise<S3GetPreviewUrlResult> {
    const path = normalizePath(options.path)
    await this.authorize({ action: 'preview.get', path, ctx })

    const expiresIn = options.expiresInSeconds ?? 60 * 5
    const key = this.pathToKey(path)

    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: options.inline ? 'inline' : 'attachment',
    })

    const url = await getSignedUrl(this.s3, cmd, { expiresIn })

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
    return { path, url, expiresAt }
  }
}
