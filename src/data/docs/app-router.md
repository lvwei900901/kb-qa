# App Router 基础

App Router 是 Next.js 13 引入的路由架构，基于 React Server Components，使用 app/ 目录组织页面。它与旧的 pages/ 目录可以共存，但新项目建议统一使用 App Router。

## 目录约定

app/ 目录下的文件夹映射到 URL 路径。app/page.tsx 对应根路由 /，app/about/page.tsx 对应 /about。文件夹嵌套形成路径层级，只有包含 page.tsx 的文件夹才会生成可访问的路由。

## 特殊文件

layout.tsx 是布局组件，包裹当前目录及子目录的页面，切换路由时不会重新挂载。template.tsx 与 layout 类似，但每次导航都会重新挂载，适合需要动画或重置状态的场景。loading.tsx 是基于 Suspense 的加载界面，在数据加载期间显示。error.tsx 是错误边界，捕获当前路由段的错误，必须标记为 Client Component。not-found.tsx 定义 404 页面。route.ts 是 API 路由处理器，对应旧的 pages/api。

## 路由段与动态路由

用方括号创建动态段，例如 app/blog/[slug]/page.tsx 匹配 /blog/hello。page.tsx 通过 params 属性接收动态参数。在 Next.js 15 中 params 是 Promise，需要用 await params 取值。[...slug] 匹配多级路径，[[...slug]] 匹配零到多级。

## 路由组与平行路由

(group) 语法创建路由组，不影响 URL，用于共享布局或组织文件。@slot 语法创建平行路由，允许同一布局中渲染多个独立区域，常用于仪表盘的侧边栏与主内容。

## 拦截路由

(.) 语法可以拦截路由，实现模态框等交互。例如从照片列表点击打开详情时显示模态框，而直接访问 URL 时显示完整页面。
