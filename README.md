![s3kit-demo](./s3kit-demo.gif)

# [s3kit](https://www.npmjs.com/package/s3kit)

A secure, server-driven, framework-agnostic S3 file manager with a React UI.

Package modules:

- `core`: S3 operations (virtual folders, pagination, presigned uploads, previews)
- `http`: thin HTTP handler (maps requests to core)
- `adapters/*`: framework adapters (Express, Next.js, Fetch/Remix)
- `client`: browser helper (typed API calls + multi-file upload orchestration)

## Install

```bash
npm i s3kit
```

## Quickstart (local testing)

This repo includes a working Next.js example with a customizer UI and live preview.

### 1) Set up the Next.js example

```bash
cd examples/nextjs-app

# Copy environment template and configure
cp .env.example .env
```

Edit `.env` with your S3 credentials:

```env
AWS_REGION=us-east-1
S3_BUCKET=your-bucket-name
S3_ROOT_PREFIX=dev  # optional, keeps test files under dev/
```

Then run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`

### 2) Configure S3 CORS (required for browser uploads)

Uploads use presigned `PUT` URLs, which means the browser uploads directly to S3.

Your bucket must allow CORS from your UI origin (example: `http://localhost:3000`) with:

- `PUT` (uploads)
- `GET` (previews)
- `HEAD` (often used by browsers)

Example CORS configuration:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT", "HEAD", "OPTIONS"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

If uploads still fail with a CORS error:

- Confirm the UI origin matches exactly (scheme, host, and port).
- Ensure the bucket CORS rules are applied to the correct bucket.
- Include `OPTIONS` and `PUT` in `AllowedMethods` (preflight + upload).
- If you set custom headers in `prepareUploads`, include them in `AllowedHeaders`.

## Credentials and security

- S3 credentials must be configured on the server (Node).
- Do not put credentials in the browser app.
- Credentials are read from environment variables or AWS SDK defaults.

## Server-side (core)

```ts
import { S3Client } from '@aws-sdk/client-s3';
import { S3FileManager } from 's3kit/core';

const s3 = new S3Client({ region: process.env.AWS_REGION });

const manager = new S3FileManager(s3, {
  bucket: process.env.S3_BUCKET!,
  rootPrefix: 'uploads',
  authorizationMode: 'deny-by-default',
  hooks: {
    authorize: ({ ctx }) => Boolean(ctx.userId),
    allowAction: ({ action, path }) => {
      if (action === 'file.delete') return false;
      if (path && path.startsWith('private/')) return false;
      return true;
    }
  }
});
```

`authorize` returning `false` responds with a 401. `allowAction` returning `false` responds with a 403. `authorizationMode` defaults to `deny-by-default`.

### Authorization hooks (agnostic)

Use `authorize` for auth checks and `allowAction` for per-action rules. Both hooks are optional, but with the default `deny-by-default`, you must provide at least one.

Example: API key auth (framework-agnostic)

```ts
const manager = new S3FileManager(s3, {
  bucket: process.env.S3_BUCKET!,
  authorizationMode: 'deny-by-default',
  hooks: {
    authorize: ({ ctx }) => ctx.apiKey === process.env.FILE_MANAGER_API_KEY
  }
});
```

### S3-compatible endpoints (MinIO, LocalStack, R2, Spaces, Wasabi, ...)

You can point the AWS SDK client at an S3-compatible endpoint:

```ts
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === '1'
});
```

### Virtual folder listing + pagination

```ts
const page1 = await manager.list({ path: '', limit: 100 }, { userId: '123' });
const page2 = await manager.list({ path: '', cursor: page1.nextCursor, limit: 100 }, { userId: '123' });
```

## HTTP layer

The HTTP handler expects JSON `POST` requests.

Routes:

- `POST /list`
- `POST /search`
- `POST /folder/create`
- `POST /folder/delete`
- `POST /files/delete`
- `POST /files/copy`
- `POST /files/move`
- `POST /upload/prepare`
- `POST /preview`

Notes:

- `POST /search` returns file entries in stable, S3 listing order (lexicographic by key/path) so pagination via `cursor` is deterministic.
- `cursor` is the underlying S3 continuation token; pass `nextCursor` from the previous response to fetch the next page.

### Next.js (App Router) adapter

```ts
// app/api/s3/[...path]/route.ts
import { createNextRouteHandlerFromEnv } from 's3kit/adapters/next';

export const POST = createNextRouteHandlerFromEnv({
  basePath: '/api/s3',
  authorization: {
    mode: 'allow-by-default'
  },
  env: {
    region: 'AWS_REGION',
    bucket: 'S3_BUCKET',
    rootPrefix: 'S3_ROOT_PREFIX',
    endpoint: 'S3_ENDPOINT',
    forcePathStyle: 'S3_FORCE_PATH_STYLE',
    requireUserId: 'REQUIRE_USER_ID'
  }
});
```

This helper reads env values from the map above. At minimum, `region` and `bucket`
must point to defined env vars. For production, replace the example `allow-by-default`
with your own `authorize` / `allowAction` hooks.

### Express adapter

```ts
import express from 'express';
import { createExpressS3FileManagerHandler } from 's3kit/adapters/express';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.use(
  '/api/s3',
  createExpressS3FileManagerHandler({
    manager,
    getContext: (req) => ({ userId: req.header('x-user-id') ?? undefined }),
    api: { basePath: '/api/s3' }
  })
);

app.listen(3001);
```

### Fetch/Remix adapter

```ts
import { createFetchHandler } from 's3kit/adapters/fetch';

export const handler = createFetchHandler({
  manager,
  getContext: async (req) => ({ userId: req.headers.get('x-user-id') ?? undefined }),
  api: { basePath: '/api/s3' }
});
```

## Client helper

```ts
import { S3FileManagerClient } from 's3kit/client';

const client = new S3FileManagerClient({
  apiUrl: '/api/s3'
});

const listing = await client.list({ path: '' });

const preview = await client.getPreviewUrl({ path: 'docs/readme.pdf', inline: true });

await client.uploadFiles({
  files: [
    { file: someFile, path: `docs/${someFile.name}` },
    { file: otherFile, path: `docs/${otherFile.name}` }
  ],
  hooks: {
    onUploadProgress: ({ path, loaded, total }) => {
      console.log(path, loaded, total);
    }
  }
});
```

### Alternative client config

If you prefer splitting origin + mount path:

```ts
const client = new S3FileManagerClient({
  baseUrl: 'http://localhost:3000',
  basePath: '/api/s3'
});
```

## Multiple S3 configs (multiple API endpoints)

For multi-bucket / multi-environment setups, keep configs on the server and expose them as separate API endpoints.

- The client simply points to the right `apiUrl` (e.g. `/api/s3` vs `/api/s3-media`).
- The server routes each endpoint to its own `S3FileManager` instance.

Example (framework-agnostic `http` handler):

```ts
import { createS3FileManagerHttpHandler } from 's3kit/http';

export const s3Handler = createS3FileManagerHttpHandler({
  getManager: () => managers.default,
  api: { basePath: '/api/s3' }
});

export const mediaHandler = createS3FileManagerHttpHandler({
  getManager: () => managers.media,
  api: { basePath: '/api/s3-media' }
});
```

## React embed examples

### Common UI props

- `theme`: `'light' | 'dark' | 'system'`
- `mode`: `'viewer' | 'picker' | 'manager'`
- `selection`: `'single' | 'multiple'`
- `toolbar`: `{ search, breadcrumbs, viewSwitcher, sort }`
- `labels`: text overrides for buttons and placeholders
- `viewMode`: `'grid' | 'list'`

The React UI is styled with CSS variables + CSS modules to keep styles scoped.

### 1) Viewer (read-only file browser)

```tsx
import { FileManager } from 's3kit/react';

export function FileViewer() {
  return (
    <FileManager
      apiUrl="/api/s3"
      mode="viewer"
      allowActions={{ upload: false, createFolder: false, delete: false, rename: false, move: false, copy: false, restore: false }}
    />
  );
}
```

### 2) Picker (select one or many files)

```tsx
import { FilePicker } from 's3kit/react';

export function FileField() {
  return (
    <FilePicker
      apiUrl="/api/s3"
      selection="single"
      onConfirm={(entries) => {
        const file = entries[0];
        console.log('Selected:', file);
      }}
      onSelectionChange={(entries) => {
        console.log('Current selection:', entries);
      }}
      confirmLabel="Use file"
      allowActions={{ upload: true, createFolder: true }}
    />
  );
}
```

### 3) Manager (full CRUD)

```tsx
import { FileManager } from 's3kit/react';

export function FileManagerAdmin() {
  return (
    <FileManager
      apiUrl="/api/s3"
      mode="manager"
      selection="multiple"
      allowActions={{
        upload: true,
        createFolder: true,
        delete: true,
        rename: true,
        move: true,
        copy: true,
        restore: true
      }}
    />
  );
}
```

### UI customization (toolbar + labels)

```tsx
import { FileManager } from 's3kit/react';

export function FileManagerCustomized() {
  return (
    <FileManager
      apiUrl="/api/s3"
      toolbar={{ search: false, breadcrumbs: true, viewSwitcher: true, sort: false }}
      labels={{
        upload: 'Add files',
        newFolder: 'Create folder',
        delete: 'Remove',
        deleteForever: 'Remove forever',
        restore: 'Restore',
        emptyTrash: 'Clear trash',
        confirm: 'Select',
        searchPlaceholder: 'Search...'
      }}
      viewMode="grid"
    />
  );
}
```

## Example

- `examples/nextjs-app`: Next.js App Router example with a customizer panel and live preview

## Security checklist

- Keep S3 credentials on the server only.
- Require auth on the API route (session/JWT/API key).
- Use `deny-by-default` and implement `authorize` / `allowAction`.
- Enforce least-privilege IAM policies for the bucket.
- Validate inputs (paths, allowed actions) and consider rate limiting.
