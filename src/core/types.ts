export type S3FileManagerAction =
  | 'list'
  | 'search'
  | 'folder.create'
  | 'folder.delete'
  | 'upload.prepare'
  | 'file.delete'
  | 'file.copy'
  | 'file.move'
  | 'folder.copy'
  | 'folder.move'
  | 'preview.get'

export type S3Path = string

export interface S3FileManagerAuthContext {
  userId?: string
  [key: string]: unknown
}

export interface S3FileManagerAuthorizeArgs {
  action: S3FileManagerAction
  path?: S3Path
  fromPath?: S3Path
  toPath?: S3Path
  ctx: S3FileManagerAuthContext
}

export type S3FileManagerAuthorizeHook = (
  args: S3FileManagerAuthorizeArgs,
) => boolean | void | Promise<boolean | void>

export type S3FileManagerAllowActionHook = (
  args: S3FileManagerAuthorizeArgs,
) => boolean | Promise<boolean>

export type S3FileManagerAuthorizationMode = 'allow-by-default' | 'deny-by-default'

export interface S3FolderEntry<FolderExtra = unknown> {
  type: 'folder'
  path: S3Path
  name: string
  extra?: FolderExtra
}

export interface S3FileEntry<FileExtra = unknown> {
  type: 'file'
  path: S3Path
  name: string
  size?: number
  lastModified?: string
  etag?: string
  contentType?: string
  extra?: FileExtra
}

export type S3Entry<FileExtra = unknown, FolderExtra = unknown> =
  | S3FileEntry<FileExtra>
  | S3FolderEntry<FolderExtra>

export interface S3ListOptions {
  path: S3Path
  cursor?: string
  limit?: number
}

export interface S3ListResult<FileExtra = unknown, FolderExtra = unknown> {
  path: S3Path
  entries: Array<S3Entry<FileExtra, FolderExtra>>
  nextCursor?: string
}

export interface S3SearchOptions {
  query: string
  path?: S3Path // Optional: search within specific path
  recursive?: boolean // Default: true
  limit?: number
  cursor?: string
}

export interface S3SearchResult<FileExtra = unknown, FolderExtra = unknown> {
  query: string
  entries: Array<S3Entry<FileExtra, FolderExtra>>
  nextCursor?: string
}

export interface S3CreateFolderOptions {
  path: S3Path
}

export interface S3DeleteFolderOptions {
  path: S3Path
  recursive?: boolean
}

export interface S3DeleteFilesOptions {
  paths: S3Path[]
}

export interface S3CopyOptions {
  fromPath: S3Path
  toPath: S3Path
}

export interface S3MoveOptions {
  fromPath: S3Path
  toPath: S3Path
}

export interface S3PrepareUploadItem {
  path: S3Path
  contentType?: string
  cacheControl?: string
  contentDisposition?: string
  metadata?: Record<string, string>
}

export interface S3PreparedUpload {
  path: S3Path
  url: string
  method: 'PUT'
  headers: Record<string, string>
}

export interface S3PrepareUploadsOptions {
  items: S3PrepareUploadItem[]
  expiresInSeconds?: number
}

export interface S3GetPreviewUrlOptions {
  path: S3Path
  expiresInSeconds?: number
  inline?: boolean
}

export interface S3GetPreviewUrlResult {
  path: S3Path
  url: string
  expiresAt: string
}

export interface S3FileDecorationArgs {
  path: S3Path
  key: string
}

export interface S3FolderDecorationArgs {
  path: S3Path
  prefix: string
}

export interface S3FileManagerHooks<FileExtra = unknown, FolderExtra = unknown> {
  authorize?: S3FileManagerAuthorizeHook
  allowAction?: S3FileManagerAllowActionHook
  decorateFile?: (file: S3FileEntry<FileExtra>, args: S3FileDecorationArgs) => void | Promise<void>
  decorateFolder?: (
    folder: S3FolderEntry<FolderExtra>,
    args: S3FolderDecorationArgs,
  ) => void | Promise<void>
}

export interface S3FileManagerOptions<FileExtra = unknown, FolderExtra = unknown> {
  bucket: string
  rootPrefix?: string
  delimiter?: string
  authorizationMode?: S3FileManagerAuthorizationMode
  hooks?: S3FileManagerHooks<FileExtra, FolderExtra>
}
