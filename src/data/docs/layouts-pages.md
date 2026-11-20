---
version: 15
topic: layouts
---

# 布局与页面

## 根布局

app/layout.tsx 是根布局，必须包含 html 和 body 标签。Next.js 会自动创建这两个标签，但根布局中需要显式写出。根布局是 Server Component，可以设置全局 metadata。

## 嵌套布局

布局可以嵌套。子布局接收 children prop，渲染在父布局内部。布局在导航时不会重新渲染，状态得以保留。例如仪表盘布局中的侧边栏在页面切换时保持选中状态。

## Metadata

用 export const metadata 定义页面元信息，支持 title、description、openGraph 等。动态路由可用 generateMetadata 函数根据 params 生成。title 支持模板，在父布局定义 title.template 为 %s | 站点名。

## 页面组件

page.tsx 默认是异步 Server Component，可以直接 await 数据。动态路由的 params 和搜索参数 searchParams 在 Next.js 15 中都是 Promise，需要 await 后使用。
