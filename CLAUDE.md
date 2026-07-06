# auwe

一个纯客户端（静态 SPA）的职场工具站，三个页面：

1. **简历（Resume）** — 用 Markdown 编写，实时渲染成优雅的简历；支持用户传入 Endpoint + API_KEY，对内容做润色 / 提建议，用户依据建议手动改 Markdown。
2. **文风（Polish）** — 帮用户润色职场语言、把工作量量化，成为更好的职场写手。
3. **工具（Tools）** — 常用小工具集合（时间戳转换等）。

## 核心架构原则（改动前必须理解）

- **纯客户端 BYOK**：LLM 调用**从浏览器直接发出**，API_KEY 只存在用户本地（localStorage），永不上送到我们的服务器。这是隐私卖点，不要引入需要托管密钥的后端。
- 无传统后端、无数据库、无 SEO 需求 → 静态部署（Cloudflare Pages / Vercel）。
- 需要服务端能力时，只用 edge function（目前唯一预期用途是 CORS 代理，见下）。

## 技术栈（约定，勿擅自更换）

| 层 | 选型 |
|---|---|
| 构建 | Vite |
| 框架 | React 19 + TypeScript（strict） |
| 路由 | React Router v7 |
| 样式 | Tailwind v4 + shadcn/ui |
| 状态 | Zustand（persist 中间件持久化 settings / 草稿到 localStorage） |
| LLM 调用 | Vercel AI SDK v5（`ai` + `@ai-sdk/openai`，自定义 `baseURL`） |
| Markdown 编辑 | CodeMirror 6 |
| Markdown 渲染 | react-markdown + remark-gfm + **rehype-sanitize** |
| 工具链 | Biome（lint + format）、Vitest、Playwright |
| 部署 | Cloudflare Pages / Vercel（保留 edge function 位） |

## 铁律（这些最容易被带偏，务必遵守）

1. **简历 PDF 导出走浏览器原生打印**（`@media print` + `@page` + `page-break-inside: avoid` + `window.print()`）。
   **禁止**用 html2canvas / jsPDF 把文字栅格化成图片——那样模糊、不可选中、不可搜索。
2. **所有 Markdown 渲染必须经过 `rehype-sanitize`**。渲染的内容不可信：用户输入的 Markdown、以及 **LLM 返回的 Markdown** 都可能含 XSS。同页存着 API_KEY，一旦 XSS 后果严重。
3. **LLM 调用统一走 AI SDK 的 `streamText`**，润色/建议功能必须是流式输出，不要写成一次性返回。
4. **CORS 兜底**：默认浏览器直连用户端点；Anthropic 端点需加 `anthropic-dangerous-direct-browser-access: true` 头。端点不支持 CORS 时，走可选的 edge function 代理，不要把这当作默认路径。
5. API_KEY 等敏感值只进 localStorage，**不得**写进日志、URL query、或任何会离开浏览器的地方。

## 目录约定

<!-- 脚手架落地后补充实际结构。预期：
  src/pages/{resume,polish,tools}/  — 三个页面
  src/lib/llm/                      — AI SDK 封装、provider 配置
  src/lib/markdown/                 — 渲染 + sanitize 配置
  src/stores/                       — Zustand stores
  src/components/ui/                — shadcn 组件
-->

## 命令

<!-- 脚手架落地后补充：dev / build / test / lint 的实际命令 -->

## 工作方式

- 组件级改动：直接实现 + 用 Playwright 打开页面截图/看 console 迭代，别先写长 plan。
- 需要 plan mode 的场景：① 项目脚手架与目录结构；② 简历的数据模型 + 打印样式方案（返工成本高）。
- 简历页视觉：值得走一遍 design token 流程（`artifact-design`），避免出来「像模板」。
