import type {
  S3CopyOptions,
  S3CreateFolderOptions,
  S3DeleteFilesOptions,
  S3DeleteFolderOptions,
  S3GetFolderLockOptions,
  S3GetFileAttributesOptions,
  S3GetPreviewUrlOptions,
  S3ListOptions,
  S3MoveOptions,
  S3PrepareUploadsOptions,
  S3SearchOptions,
  S3SetFileAttributesOptions,
} from '../core/types'

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[]

export interface HttpRequest {
  method: string
  path: string
  query: Record<string, string | string[] | undefined>
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

export interface HttpResponse {
  status: number
  headers?: Record<string, string>
  body?: JsonValue
}

export interface S3FileManagerApiErrorBody {
  error: {
    code: string
    message: string
  }
}

export interface S3FileManagerApiRequestMap {
  'POST /list': S3ListOptions
  'POST /search': S3SearchOptions
  'POST /folder/create': S3CreateFolderOptions
  'POST /folder/delete': S3DeleteFolderOptions
  'POST /files/delete': S3DeleteFilesOptions
  'POST /files/copy': S3CopyOptions
  'POST /files/move': S3MoveOptions
  'POST /upload/prepare': S3PrepareUploadsOptions
  'POST /preview': S3GetPreviewUrlOptions
  'POST /folder/lock/get': S3GetFolderLockOptions
  'POST /file/attributes/get': S3GetFileAttributesOptions
  'POST /file/attributes/set': S3SetFileAttributesOptions
}

export interface S3FileManagerApiOptions {
  basePath?: string
}
