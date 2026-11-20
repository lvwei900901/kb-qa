---
version: 16
topic: route-handlers
---

# Route Handlers in Next.js 16

Route handlers live in `route.ts` and export HTTP method functions such as GET and POST. They replace the old `pages/api` convention.

## Route context params are async

In Next.js 16 the `params` object in a route handler's second argument is a Promise and must be awaited. The `RouteContext` type helper is available via `npx next typegen`.

```ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return Response.json({ id })
}
```

## Server Actions and revalidation

Server Actions (`'use server'`) run server code from the client. In Next.js 16, `revalidateTag` requires a second `cacheLife` profile argument:

```ts
// Next.js 15: revalidateTag('posts')
// Next.js 16:
revalidateTag('posts', 'max')
```

For read-your-writes behavior in a Server Action, use the new `updateTag` API, which expires and immediately refreshes data in the same request.

## next/image configuration changes (breaking)

`images.minimumCacheTTL` default changed from 60 seconds to 4 hours (14400s); set it back to `60` to restore old behavior. The value `16` was removed from default `images.imageSizes`. `images.qualities` now defaults to only `[75]`; unsupported `quality` props are coerced to the nearest allowed value. Local images with query strings now require `images.localPatterns.search` configuration.
