import type {
  S3GetPreviewUrlResult,
  S3ListResult,
  S3PreparedUpload,
  S3SearchResult,
} from '../core/types'

export interface S3FileManagerClientCommonOptions {
  fetch?: typeof fetch
}

export type S3FileManagerClientOptions =
  | (S3FileManagerClientCommonOptions & { apiUrl: string })
  | (S3FileManagerClientCommonOptions & { baseUrl: string; basePath?: string })

export type S3FileManagerClientInitOptions = S3FileManagerClientOptions

export interface S3FileManagerClientUploadProgressEvent {
  path: string
  loaded: number
  total?: number
}

export interface S3FileManagerClientHooks {
  onUploadProgress?: (evt: S3FileManagerClientUploadProgressEvent) => void
  onUploadComplete?: (args: { path: string }) => void | Promise<void>
  onUploadError?: (args: { path: string; error: unknown }) => void | Promise<void>
}

export type S3FileManagerClientListResult = S3ListResult
export type S3FileManagerClientSearchResult = S3SearchResult
export type S3FileManagerClientPreviewResult = S3GetPreviewUrlResult
export type S3FileManagerClientPreparedUpload = S3PreparedUpload
