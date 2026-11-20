# Route Handler API

app/api/xxx/route.ts 定义 API 端点，导出同名 HTTP 方法函数：GET、POST、PUT、PATCH、DELETE、HEAD、OPTIONS。

## 基础用法

导出 async function GET 并接收 request 参数，返回 Response.json 即可生成 JSON 响应。POST 函数用 await request.json() 读取请求体，返回 Response.json(data, { status: 201 })。

## 动态参数

app/api/posts/[id]/route.ts 中，方法第二个参数包含 params。Next.js 15 中 params 是 Promise，类型是 Promise<{ id: string }>，需要 await params 才能取值。

## 流式响应

返回 ReadableStream 可实现流式输出，适合 AI 回答和大文件下载。在 start 回调中用 controller.enqueue 写入 TextEncoder 编码的字节，结束后调用 controller.close。返回 Response 时设置 Content-Type 为 text/event-stream，这就是常见的 SSE 模式。

## 注意事项

Route Handler 默认静态缓存，调用 request.json() 或使用动态 API 后转为动态渲染。可以用 export const dynamic = "force-dynamic" 强制动态。Route Handler 在服务端执行，适合放 API Key 等敏感信息，不会泄露到浏览器。
