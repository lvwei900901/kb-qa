import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 本地沙箱用 .next-build 规避目录删除限制；Vercel 构建环境用默认的 .next
  ...(process.env.VERCEL ? {} : { distDir: ".next-build" }),

  // 索引在运行时通过 fs.readFile 动态读取，Next.js 的静态依赖追踪看不到，
  // 需显式声明，否则部署后函数里没有这个文件，问答会返回空结果。
  outputFileTracingIncludes: {
    "/api/chat": ["./data/index.json"],
    "/": ["./data/index.json"],
  },
};

export default nextConfig;
