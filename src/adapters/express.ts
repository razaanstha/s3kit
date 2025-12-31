import type { Request, Response } from 'express'

import type { HttpRequest } from '../http/types'
import { createS3FileManagerHttpHandler } from '../http/handler'

export type ExpressS3FileManagerHandlerOptions<FileExtra, FolderExtra> = Parameters<
  typeof createS3FileManagerHttpHandler<FileExtra, FolderExtra>
>[0]

function toSingleHeaderValue(val: string | string[] | undefined): string | undefined {
  if (typeof val === 'string') return val
  if (Array.isArray(val)) return val.join(',')
  return undefined
}

export function createExpressS3FileManagerHandler<FileExtra = unknown, FolderExtra = unknown>(
  options: ExpressS3FileManagerHandlerOptions<FileExtra, FolderExtra>,
): (req: Request, res: Response) => Promise<void> {
  const handler = createS3FileManagerHttpHandler(options)

  return async (req: Request, res: Response) => {
    const httpReq: HttpRequest = {
      method: req.method,
      path: `${req.baseUrl ?? ''}${req.path}`,
      query: req.query as any,
      headers: req.headers as any,
      body: req.body,
    }

    const out = await handler(httpReq)
    if (out.headers) {
      for (const [k, v] of Object.entries(out.headers)) {
        res.setHeader(k, v)
      }
    }

    if (out.status === 204) {
      res.status(204).end()
      return
    }

    const ct = toSingleHeaderValue((out.headers ?? {})['content-type'])
    if (ct?.includes('application/json')) {
      res.status(out.status).json(out.body ?? null)
      return
    }

    res.status(out.status).send(out.body ?? null)
  }
}
