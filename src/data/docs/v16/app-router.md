---
version: 16
topic: routing
---

# App Router in Next.js 16

The App Router uses the `app/` directory and React Server Components. In Next.js 16 it runs on React 19.2 and Turbopack is the default bundler for both `next dev` and `next build`.

## Async Request APIs are now mandatory

In Next.js 15, `params`, `searchParams`, `cookies()`, `headers()`, and `draftMode()` became Promise-based but kept **temporary synchronous compatibility**. Starting with Next.js 16, synchronous access is **fully removed**. These APIs can only be read asynchronously.

```tsx
// Next.js 16 - must await params
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <h1>{slug}</h1>
}
```

This applies to `params` in `layout.js`, `page.js`, `route.js`, `default.js`, `opengraph-image`, `twitter-image`, `icon`, and `apple-icon`, and to `searchParams` in `page.js`. Use `npx next typegen` to generate `PageProps`, `LayoutProps`, and `RouteContext` helpers for type-safe migration.

## middleware renamed to proxy

The `middleware` filename is deprecated and renamed to `proxy` to clarify its network-boundary and routing focus. Rename `middleware.ts` to `proxy.ts` and the exported function from `middleware` to `proxy`:

```ts
// proxy.ts (Next.js 16)
export function proxy(request: Request) {}
```

The `edge` runtime is **not** supported in `proxy`; its runtime is `nodejs` and cannot be configured. If you must keep the `edge` runtime, continue using `middleware`. Config flags were renamed too: `skipMiddlewareUrlNormalize` is now `skipProxyUrlNormalize`.

## Turbopack by default

Turbopack is stable and enabled by default. Scripts no longer need `--turbopack`:

```json
{ "scripts": { "dev": "next dev", "build": "next build", "start": "next start" } }
```

If a custom `webpack` config exists, `next build` now **fails** to prevent misconfiguration. Use `next build --webpack` to opt out, or migrate the config. `experimental.turbopack` moved to a top-level `turbopack` key. Filesystem caching is enabled by default for dev and build.

## Node.js and TypeScript requirements

Node.js minimum is now `20.9.0` (Node 18 is no longer supported). TypeScript minimum is `5.1.0`. Supported browsers: Chrome 111+, Edge 111+, Firefox 111+, Safari 16.4+.
