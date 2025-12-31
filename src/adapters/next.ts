import { S3Client } from '@aws-sdk/client-s3'
import type {
  S3FileManagerAllowActionHook,
  S3FileManagerAuthContext,
  S3FileManagerAuthorizationMode,
  S3FileManagerAuthorizeHook,
} from '../core/types'
import { S3FileManager } from '../core/manager'
import type { HttpRequest, S3FileManagerApiOptions } from '../http/types'
import { createS3FileManagerHttpHandler } from '../http/handler'

export type NextS3FileManagerHandlerOptions<FileExtra, FolderExtra> = Parameters<
  typeof createS3FileManagerHttpHandler<FileExtra, FolderExtra>
>[0]

export type NextRouteHandlerFromEnvOptions = {
  basePath?: string
  userIdHeader?: string
  authorization?: {
    mode?: S3FileManagerAuthorizationMode
    authorize?: S3FileManagerAuthorizeHook
    allowAction?: S3FileManagerAllowActionHook
  }
  env?: {
    region: string
    bucket: string
    rootPrefix?: string
    endpoint?: string
    forcePathStyle?: string
    requireUserId?: string
  }
}

async function readJsonBody(req: Request): Promise<unknown> {
  const ct = req.headers.get('content-type') ?? ''
  if (!ct.includes('application/json')) return undefined
  return await req.json()
}

export function createNextRouteHandler<FileExtra = unknown, FolderExtra = unknown>(
  options: NextS3FileManagerHandlerOptions<FileExtra, FolderExtra>,
): (req: Request) => Promise<Response> {
  const handler = createS3FileManagerHttpHandler(options)

  return async (req: Request) => {
    const url = new URL(req.url)
    const body = await readJsonBody(req)

    const httpReq: HttpRequest = {
      method: req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      headers: Object.fromEntries(req.headers.entries()),
      body,
    }

    const out = await handler(httpReq)
    const init: ResponseInit = { status: out.status }
    if (out.headers) init.headers = out.headers
    return new Response(out.body ? JSON.stringify(out.body) : null, init)
  }
}

let cachedEnvManager: S3FileManager | undefined
let cachedEnvSignature: string | undefined
function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

function parseBool(v: string | undefined): boolean {
  if (!v) return false
  return v === '1' || v.toLowerCase() === 'true'
}

function getEnvManager(options: NextRouteHandlerFromEnvOptions): S3FileManager {
  const envMap = options.env
  const envSignature = JSON.stringify(envMap ?? {})
  if (cachedEnvManager && cachedEnvSignature === envSignature) return cachedEnvManager

  const cfg = {
    region: requiredEnv(envMap?.region ?? 'AWS_REGION'),
    bucket: requiredEnv(envMap?.bucket ?? 'S3_BUCKET'),
    rootPrefix: process.env[envMap?.rootPrefix ?? 'S3_ROOT_PREFIX'] ?? '',
    endpoint: process.env[envMap?.endpoint ?? 'S3_ENDPOINT'],
    forcePathStyle: parseBool(process.env[envMap?.forcePathStyle ?? 'S3_FORCE_PATH_STYLE']),
    requireUserId: parseBool(process.env[envMap?.requireUserId ?? 'REQUIRE_USER_ID']),
  }

  const s3 = new S3Client({
    region: cfg.region,
    ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
    ...(cfg.forcePathStyle ? { forcePathStyle: true } : {}),
  })

  const authorizeHook =
    cfg.requireUserId || options.authorization?.authorize
      ? async (args: Parameters<NonNullable<S3FileManagerAuthorizeHook>>[0]) => {
          if (cfg.requireUserId && !args.ctx.userId) {
            return false
          }
          return options.authorization?.authorize?.(args)
        }
      : undefined
  const allowActionHook = options.authorization?.allowAction
  const hooks =
    authorizeHook || allowActionHook
      ? {
          ...(authorizeHook ? { authorize: authorizeHook } : {}),
          ...(allowActionHook ? { allowAction: allowActionHook } : {}),
        }
      : undefined

  cachedEnvManager = new S3FileManager(s3, {
    bucket: cfg.bucket,
    rootPrefix: cfg.rootPrefix,
    ...(options.authorization?.mode ? { authorizationMode: options.authorization.mode } : {}),
    ...(hooks ? { hooks } : {}),
  })
  cachedEnvSignature = envSignature

  return cachedEnvManager
}

function getContextFromHeaders(
  headers: Record<string, string | string[] | undefined>,
  headerName: string,
): S3FileManagerAuthContext {
  const raw = headers[headerName]
  const userId = Array.isArray(raw) ? raw[0] : raw
  return userId ? { userId } : {}
}

export function createNextRouteHandlerFromEnv(
  options: NextRouteHandlerFromEnvOptions = {},
): (req: Request) => Promise<Response> {
  const api: S3FileManagerApiOptions | undefined = options.basePath
    ? { basePath: options.basePath }
    : undefined

  const handlerOptions: NextS3FileManagerHandlerOptions<unknown, unknown> = {
    getManager: () => getEnvManager(options),
    getContext: (req) => getContextFromHeaders(req.headers, options.userIdHeader ?? 'x-user-id'),
  }

  if (api) handlerOptions.api = api

  return createNextRouteHandler(handlerOptions)
}

export function createNextApiHandler<FileExtra = unknown, FolderExtra = unknown>(
  options: NextS3FileManagerHandlerOptions<FileExtra, FolderExtra>,
): (req: any, res: any) => Promise<void> {
  const handler = createS3FileManagerHttpHandler(options)

  return async (req: any, res: any) => {
    const httpReq: HttpRequest = {
      method: req.method,
      path: req.url?.split('?')[0] ?? '/',
      query: req.query ?? {},
      headers: req.headers ?? {},
      body: req.body,
    }

    const out = await handler(httpReq)
    if (out.headers) {
      for (const [k, v] of Object.entries(out.headers)) {
        res.setHeader(k, v)
      }
    }

    res.statusCode = out.status

    if (out.status === 204) {
      res.end()
      return
    }

    res.setHeader('content-type', out.headers?.['content-type'] ?? 'application/json')
    res.end(JSON.stringify(out.body ?? null))
  }
}
