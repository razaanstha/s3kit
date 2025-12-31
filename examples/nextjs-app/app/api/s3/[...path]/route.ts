import { createNextRouteHandlerFromEnv } from 's3kit/adapters/next'

export const POST = createNextRouteHandlerFromEnv({
  basePath: '/api/s3',
  authorization: {
    mode: 'allow-by-default',
  },
  env: {
    region: 'AWS_REGION',
    bucket: 'S3_BUCKET',
    rootPrefix: 'S3_ROOT_PREFIX',
    endpoint: 'S3_ENDPOINT',
    forcePathStyle: 'S3_FORCE_PATH_STYLE',
    requireUserId: 'REQUIRE_USER_ID',
  },
})
