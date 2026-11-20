# 流式渲染与 Suspense

## loading.tsx

在路由段添加 loading.tsx，Next.js 自动用 Suspense 包裹该段，数据加载期间显示 loading 界面。这是最简单的流式方案。

## Suspense 边界

手动用 Suspense 组件包裹异步组件，传入 fallback 属性实现局部加载。多个 Suspense 边界可以并行流式传输，快的组件先显示，不必等待慢查询。

## 流式服务端渲染

流式 SSR 让浏览器逐步接收 HTML，不必等所有数据就绪。用户感知更快，尤其适合慢查询场景。与整体渲染相比，首字节时间明显缩短。

## 错误边界

error.tsx 捕获子组件抛出的错误，显示降级 UI，必须标记 "use client"。提供 reset 函数重试渲染。global-error.tsx 捕获根布局错误。
