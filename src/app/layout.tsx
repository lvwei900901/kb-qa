import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "知识库问答 · Next.js 技术文档",
  description: "基于语义检索的个人 AI 知识库问答项目",
};

const themeScript = `try{var t=localStorage.getItem("kb-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
