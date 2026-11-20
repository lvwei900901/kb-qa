---
version: 16
topic: data-fetching
---

# Data Fetching and Caching in Next.js 16

Next.js 16 introduces Cache Components and stabilizes the caching APIs. `cacheLife` and `cacheTag` are now stable — the `unstable_` prefix is no longer needed:

```ts
// Next.js 15
import { unstable_cacheLife as cacheLife, unstable_cacheTag as cacheTag } from 'next/cache'
// Next.js 16
import { cacheLife, cacheTag } from 'next/cache'
```

## revalidateTag requires a profile

`revalidateTag` now takes a second argument specifying a `cacheLife` profile. The single-argument form is deprecated and produces a TypeScript error. It uses stale-while-revalidate: readers see stale content while fresh data loads in the background.

```ts
revalidateTag('posts', 'max')
```

## updateTag for read-your-writes

`updateTag` is a new Server-Actions-only API giving read-your-writes semantics. It expires and immediately refreshes data in the same request, so the UI shows the change right away. Use it for forms, settings, and workflows where users expect instant updates.

```ts
'use server'
import { updateTag } from 'next/cache'
export async function updateProfile(id: string, profile: Profile) {
  await db.users.update(id, profile)
  updateTag(`user-${id}`)
}
```

## Partial Prerendering and Cache Components

Partial Prerendering (PPR) is enhanced through Cache Components. The `experimental_ppr` Route Segment Config is removed by the upgrade codemod. Caching behavior is driven by `cacheLife` profiles (`default`, `seconds`, `minutes`, `hours`, `days`, `week`, `max`) and `cacheTag` invalidation.
