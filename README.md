# 知识库问答（Next.js 15 / 16 双版本对比）

一个可直接运行的人工智能知识库问答个人项目：语义检索 + 流式回答 + 引用溯源 + **新旧版本差异对比**。内置 Next.js 15 中文文档与 Next.js 16 英文文档（共 13 份、58 个知识块），提问时自动识别版本相关问题，配对新旧内容并以 v16 为准给出差异提示，开箱即用。

## 版本对比能力

内置两套语料：

- `src/data/docs/*.md`：Next.js 15 中文文档（6 份，frontmatter 标注 `version: 15`）
- `src/data/docs/v16/*.md`：Next.js 16 英文文档（7 份，含官方升级指南，标注 `version: 16`）

每份文档通过 frontmatter 的 `topic` 字段配对（如 `routing`、`data-fetching`）。当问题涉及版本差异（如「params 有什么区别」「middleware 为什么改名」），系统会：

1. 按主题同时召回 v15 与 v16 的片段，新版优先展示
2. 发出 `version_diff` 事件，前端以蓝色对照卡片展示「v15 旧做法 / v16 新做法 + 差异要点」
3. 回答正文明确以 v16 为最新结论

试试这些问题：

- 「Next.js 15 和 16 的 params 有什么区别？」
- 「middleware 为什么改成了 proxy？」
- 「revalidateTag 在 16 里怎么用？」
- 「15 升级到 16 有哪些破坏性变更？」

## 快速开始

```bash
npm install
npm run ingest   # 建立向量索引（首次必做）
npm run dev      # 打开 http://localhost:3000
```

不配置任何 API Key 也能完整跑通：演示模式用本地哈希向量做检索、用抽取式方法生成回答。适合先验证链路和界面。

## 切换到真实语义检索

复制配置模板并填入 Key：

```bash
cp .env.local.example .env.local
```

两组 Key 分别对应：

- **Embedding**：智谱 `embedding-3`（本项目已验证，2048 维）、硅基流动 `BAAI/bge-m3` 或阿里百炼 `text-embedding-v3`
- **LLM**：DeepSeek `deepseek-chat` 或通义千问 `qwen-plus`

智谱配置示例（`.env.local`）：

```env
EMBEDDING_PROVIDER=zhipu
EMBEDDING_API_KEY=你的智谱Key
EMBEDDING_MODEL=embedding-3
EMBEDDING_BASE_URL=https://open.bigmodel.cn/api/paas/v4/embeddings
```

填好后**重新入库**（向量模型变了必须重建索引），再启动：

```bash
npm run ingest
npm run dev
```

> `.env.local` 已被 `.gitignore` 忽略，你的 Key 不会被提交。

## 效果评测

内置 35 条评测集（含同义改写、7 条版本对比问题与 1 条无关问题），运行：

```bash
npm run evaluate
```

输出逐条召回结果及汇总指标：Recall@5、MRR、无关问题拒答率。当前智谱 embedding-3 实测：

| 指标 | 结果 |
|---|---|
| Recall@5 | 100%（34/34） |
| MRR | 0.941 |
| 无关问题正确拒答 | 通过（最高分 0.208 < 阈值 0.25） |

评测按 `topic` 匹配（新旧版本同主题视为命中），适配双版本语料。

评测集在 `scripts/eval-set.json`，可自行增补问题与标注。

## 项目结构

```
src/
├── app/
│   ├── api/chat/route.ts   # 问答 API，SSE 流式返回
│   ├── page.tsx            # 首页（服务端读取索引状态）
│   ├── layout.tsx          # 根布局 + 主题预加载脚本
│   └── globals.css         # Tailwind v4 + 明暗主题变量
├── components/
│   ├── chat-panel.tsx      # 问答界面（客户端）
│   └── ui/                 # Button / Input 基础组件
├── data/docs/              # 语料目录：v15 根级 .md + v16/ 子目录
└── lib/
    ├── chunker.ts          # frontmatter 解析 + 按标题层级切块 + overlap
    ├── embeddings.ts       # 真实 API / 本地降级双重实现
    ├── vector-store.ts     # JSON 向量库 + 余弦相似度
    ├── version-diff.ts     # 版本识别 + 新旧主题配对 + 差异生成
    ├── llm.ts              # 真实 LLM 流式 / 演示抽取式（含版本差异）
    └── rag.ts              # 检索编排 + 版本平衡 + rerank + 引用
scripts/ingest.ts           # 离线入库脚本
data/index.json             # 向量索引（需提交：Vercel 运行时依赖它）
```

## 换成你自己的文档

1. 把 Markdown 文件放进 `src/data/docs/`，可选在文件开头加 frontmatter：

```markdown
---
version: 16        # 15 或 16，缺省为 15
topic: routing     # 主题名，相同 topic 的新旧文档会被配对对比
---

# 文档标题
```

2. 运行 `npm run ingest` 重建索引
3. 刷新页面即可提问

切块策略在 `src/lib/chunker.ts`：默认每块 800 字符、重叠 120 字符，按标题层级保留标题路径作为引用来源。版本差异的关键词与提示语在 `src/lib/version-diff.ts` 的 `TOPIC_HINTS` 中维护。

## 本地启动命令

```bash
source ~/.nvm/nvm.sh
unset NODE_OPTIONS   # WorkBuddy 环境需要：避免沙箱 shim 拦截 Next.js 的文件操作
cd kb-qa && npm run dev
```

`next.config.ts` 中仅在非 Vercel 环境设置 `distDir: ".next-build"`（规避沙箱对默认 `.next` 目录的删除限制）；部署到 Vercel 时自动使用默认 `.next`。

## 部署到 Vercel

本项目是 Next.js 全栈应用（API Route + 本地向量索引），可完整部署到 Vercel，免费 Hobby 计划足够。

### 步骤

1. 确认 `data/index.json` 已在仓库中（已提交）。若更新了文档，先本地 `npm run ingest` 并**一并提交索引文件**。
2. 打开 [vercel.com/new](https://vercel.com/new) → Import 你的 GitHub 仓库 `lvwei900901/kb-qa`。
3. Framework 自动识别为 Next.js，Build Command 保持默认 `npm run build`，无需改动。
4. 展开 **Environment Variables**，按 `.env.local.example` 填写（线上要与生成索引时用同一套 embedding 配置，否则维度不匹配）：

| 变量 | 值 | 说明 |
|---|---|---|
| `EMBEDDING_PROVIDER` | `zhipu` | 与本地一致 |
| `EMBEDDING_API_KEY` | 你的智谱 Key | `EMBEDDING_*` 四个变量决定线上检索 |
| `EMBEDDING_MODEL` | `embedding-3` | 必须与索引模型一致 |
| `EMBEDDING_BASE_URL` | `https://open.bigmodel.cn/api/paas/v4/embeddings` | |
| `LLM_API_KEY` | 可选 | 不填则回答为抽取式，填了是大模型生成 |

5. 点 Deploy。首次约 1-2 分钟，完成后得到形如 `https://kb-qa-xxx.vercel.app` 的永久链接。
6. 验证：打开链接提问「middleware 为什么改成了 proxy？」，应看到版本差异对照卡片。

### 已内置的部署适配

- `next.config.ts` 用 `outputFileTracingIncludes` 把 `data/index.json` 打进函数包——否则运行时 `fs.readFile` 读不到，问答会返回空结果。
- Vercel 构建环境（`VERCEL=1`）自动使用默认 `.next`，本地沙箱仍用 `.next-build`。
- 入库脚本只在本地跑，**不要**放进构建流程：批量 embedding 会超时且浪费额度。

> 环境变量中的 Key 只在 Vercel 后台保存，不会进入代码仓库。若之前在对话中泄露过 Key，部署前建议先去智谱后台重置。

## 后续升级路径

- 语料量上千块后，把 `vector-store.ts` 的 JSON 存储换成 Supabase pgvector 或 Qdrant，检索接口不变
- 召回要求更高时，在 `rag.ts` 里接入 bge-reranker 替换当前轻量 rerank
- 需要自定义域名时，在 Vercel 项目 Settings → Domains 绑定
