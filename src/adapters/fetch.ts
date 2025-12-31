import type { HttpRequest } from '../http/types'
import { createS3FileManagerHttpHandler } from '../http/handler'

export type FetchS3FileManagerHandlerOptions<FileExtra, FolderExtra> = Parameters<
  typeof createS3FileManagerHttpHandler<FileExtra, FolderExtra>
>[0]

async function readJsonBody(req: Request): Promise<unknown> {
  const ct = req.headers.get('content-type') ?? ''
  if (!ct.includes('application/json')) return undefined
  return await req.json()
}

export function createFetchHandler<FileExtra = unknown, FolderExtra = unknown>(
  options: FetchS3FileManagerHandlerOptions<FileExtra, FolderExtra>,
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

    if (out.status === 204) {
      return new Response(null, init)
    }

    return new Response(out.body ? JSON.stringify(out.body) : null, init)
  }
}
