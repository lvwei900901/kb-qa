# Server Components 与 Client Components

App Router 默认所有组件都是 React Server Component（RSC）。RSC 在服务端渲染，代码不会打包到客户端，可以直接访问数据库和后端资源。

## Server Components 的优势

零客户端 JavaScript 开销：组件代码只在服务端执行。直接访问后端：可以在组件中 await 数据库查询或文件系统操作。自动代码分割：只有 Client Component 才会进入客户端 bundle。更安全：API Key、数据库凭证不会暴露到浏览器。

## 何时使用 Client Component

需要交互和浏览器 API 时必须用 "use client" 标记，包括事件处理 onClick 与 onChange、React 状态与生命周期 useState 与 useEffect、浏览器 API 如 window 与 localStorage 与 Geolocation、以及多数第三方 React 库。

## 组合模式

推荐把 "use client" 尽量下推到叶子组件。例如页面是 Server Component 负责取数，只把交互部分如按钮和表单拆成 Client Component，通过 props 传递数据。这样客户端 JS 最少。

## 数据传递边界

Server Component 传给 Client Component 的 props 必须可序列化。函数、Date、Class 实例等不能直接传递。Server Action 是一个例外，可以作为 prop 传给 Client Component 并在服务端执行。

## 注意事项

Server Component 不能使用 useState 与 useEffect，也不能绑定事件。Client Component 不能直接 import Server Component，但可以通过 children 传递 Server Component 渲染结果。
