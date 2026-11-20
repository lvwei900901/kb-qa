---
version: 16
topic: server-components
---

# Server Components in Next.js 16

React Server Components let you render on the server without shipping component JavaScript to the client. Next.js 16's App Router uses the React Canary channel including the newly released React 19.2 features.

## React Compiler support is stable

Built-in support for the React Compiler is stable in Next.js 16. The compiler automatically memoizes components to reduce unnecessary re-renders with no manual code changes. Enable it with the now-stable `reactCompiler` option:

```ts
const nextConfig: NextConfig = { reactCompiler: true }
```

It is not enabled by default while build performance data is gathered. Enabling it raises compile times in dev and build because the compiler relies on Babel.

## Client Components still need 'use client'

Interactive components, event handlers, and browser APIs still require the `'use client'` directive. Server Components remain server-only by default. This distinction is unchanged from Next.js 15 — the major React change in 16 is the 19.2 feature set and optional compiler.

## Removed features

AMP support is fully removed: the `amp` config key, `next/amp` imports, `useAmp`, and `export const config = { amp: true }`. The `next lint` command is removed — use Biome or ESLint directly, and `next build` no longer runs linting. The `eslint` option in `next.config` is also removed.
