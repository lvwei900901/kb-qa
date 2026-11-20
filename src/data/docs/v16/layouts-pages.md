---
version: 16
topic: layouts
---

# Layouts and Pages in Next.js 16

Layouts still wrap pages and preserve state across navigation: child layouts receive `children` and render inside the parent layout. A layout does not re-render on navigation, so state such as a sidebar selection is preserved. `template.tsx` remounts on every navigation, useful for animations or resetting state.

## Layout props are async

In Next.js 16, `params` passed to a layout is a Promise. Await it before use:

```tsx
export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ team: string }>
}) {
  const { team } = await params
  return <section>{children}</section>
}
```

The generated `LayoutProps<'/dashboard/[team]'>` helper from `npx next typegen` gives full type safety.

## Parallel routes need default.tsx

Parallel routes using `@slot` folders still require a `default.tsx` for slots that have no matching state on hard navigation. In Next.js 16, `default.tsx` can call `notFound()` or return `null`:

```tsx
// app/@modal/default.tsx
export default function Default() {
  return null
}
```

## Scroll behavior override changed (breaking change)

Before Next.js 16, if you set `scroll-behavior: smooth` globally in CSS, Next.js temporarily overrode it to `auto` during SPA route transitions to keep navigation instant. In Next.js 16 this override no longer happens by default. To restore the old behavior add `data-scroll-behavior="smooth"` to your `<html>` element.
