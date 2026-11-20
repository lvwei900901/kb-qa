---
version: 15
topic: data-fetching
---

# 数据获取与缓存

## fetch 与缓存

App Router 扩展了原生 fetch，默认强制缓存 force-cache。设置 cache 为 no-store 禁用缓存，每次请求重新获取。next: { revalidate: 60 } 表示 60 秒后重新验证。

## revalidate

revalidate 是增量静态再生 ISR 的核心。页面在构建时生成，超过 revalidate 时间后，下次请求触发后台重新生成，期间返回旧内容。适合内容更新不频繁的页面。

## 动态渲染

使用 cookies、headers、searchParams 或 no-store 会让路由转为动态渲染，每次请求在服务端生成。静态路由在构建时生成，动态路由在请求时生成。

## Server Actions

用 "use server" 定义服务端函数，可从 Client Component 直接调用，无需手写 API 路由。适合表单提交和数据变更。配合 revalidatePath 或 revalidateTag 刷新缓存。
