export class S3FileManagerAuthorizationError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.status = status
    this.code = code
  }
}
