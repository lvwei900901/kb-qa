---
version: 16
topic: streaming
---

# Streaming and Turbopack in Next.js 16

Streaming UI from the server still works through Suspense and the App Router — `loading.tsx` provides route-level streaming boundaries. Next.js 16 adds Instant Navigations (from 16.3) and performance improvements to `next dev` and `next start`, with clearer terminal output and better error messages.

## Turbopack is the default compiler

In Next.js 15, Turbopack was opt-in with `next dev --turbopack`. In Next.js 16 it is stable and used by default for both `next dev` and `next build`. Remove `--turbopack` from scripts. Use `--webpack` to opt out specifically for builds.

Turbopack File System Caching stores compiler artifacts on disk between runs and is enabled by default for dev and build, significantly speeding up recompilation after restarts.

## Build output metrics removed

Next.js 16 removes the size and First Load JS metrics from `next build` output. The team found them inaccurate for server-driven React Server Component architectures. Use Chrome Lighthouse or Vercel Analytics to measure real route performance via Core Web Vitals.

## Concurrent dev and build

`next dev` now outputs to `.next/dev` while `next build` uses a separate directory, so both commands can run concurrently. A lockfile mechanism prevents multiple `next dev` or `next build` instances on the same project.
