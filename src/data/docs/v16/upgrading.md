---
version: 16
topic: upgrading
---

# Upgrading to Next.js 16

Next.js 16 was released in October 2025 (latest patch 16.4 in October 2026). Use the upgrade codemod or the agent CLI:

```
npx next@canary upgrade --agent=latest
pnpm dlx @next/codemod@canary upgrade latest
```

The codemod updates `turbopack` config, migrates `next lint` to ESLint CLI, renames `middleware` to `proxy`, removes `unstable_` prefixes, and removes `experimental_ppr`.

## Breaking changes summary

- Node.js minimum 20.9.0 (Node 18 dropped); TypeScript minimum 5.1.0
- Turbopack is default for `next dev` and `next build`
- Async Request APIs: synchronous `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` fully removed — always `await`
- `middleware` renamed to `proxy`; `edge` runtime not supported in `proxy`
- `revalidateTag` requires a second `cacheLife` profile argument; new `updateTag` API
- `next/image`: `minimumCacheTTL` default 60s → 4h; `16` removed from `imageSizes`; `qualities` defaults to `[75]`; local query strings need `localPatterns.search`
- Scroll behavior: `scroll-behavior: smooth` no longer overridden during navigation
- `next lint` command removed; AMP support removed
- Async `id` for `sitemap`, async params and id for image-generating functions

## New capabilities

Cache Components, stable React Compiler support, React 19.2, Turbopack File System Caching, Build Adapters API (stable in 16.2), Instant Navigations (16.3), lazy compilation and smaller Turbopack output (16.4).
