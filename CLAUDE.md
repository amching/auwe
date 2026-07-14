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
| LLM 调用 | Vercel AI SDK（`ai` v7 + `@ai-sdk/openai`，自定义 `baseURL`） |
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

```
src/
  main.tsx                       # 挂载 <App/>（StrictMode + createRoot）
  App.tsx                        # createBrowserRouter：根布局 + 三路由（页面级 lazy code-split）
  index.css                      # Tailwind v4 + shadcn 主题变量
  components/
    layout/RootLayout.tsx        # 顶部导航 + <Outlet/>
    layout/SettingsDialog.tsx    # endpoint / apiKey / model 表单 → settings store
    ui/                          # shadcn 组件（Base UI 底座，用 render 而非 asChild）
  pages/
    resume/
      ResumePage.tsx             # 简历工作台：左编辑器 / 右分页预览 + 底部工具栏
      MarkdownEditor.tsx         # CodeMirror 6 编辑器
      ResumePreview.tsx          # 隐藏连续源(唯一事实源) + 真分页 A4 页框 + 缩放适配 + 智能一页
      paginate.ts                # 分页引擎：按页高切页、克隆源节点重建各页框
      usePrintResume.ts          # 原生打印导出 PDF：克隆连续源进 #print-root → window.print()
      exportName.ts              # 导出物统一命名 auwe-nb-<时间戳>（.md/PDF 文件名 + PDF 标题）
      resume.css                 # 简历纸排版(.resume-paper) + 页框 + @page/@media print（模板共用）
      templates.ts               # 视觉模板注册表（id/label：clean / color）
      templates.css              # 模板样式：每模板一个 [data-resume-template] 块（--paper-* token + 作用域版式细则）
      sampleResume.ts            # 内置示例简历内容（Markdown）
    polish/PolishPage.tsx        # 文风（已跑通的流式润色竖切片）
    tools/
      registry.ts                # 工具注册表：单一事实源（网格/⌘K 面板/路由都读它；新工具往这里加）
      ToolsLayout.tsx            # 工具区外壳：⌘K 命令面板 + 子路由
      ToolsPage.tsx              # 工具网格首页
      ToolView.tsx               # 工具专注视图 /tools/:slug（wide 工具放宽容器）
      timestamp/                 # 时间戳 ⇄ 日期时间（多时区）
      json/                      # JSON 格式化/查看：CodeMirror 源码编辑 + 虚拟化树视图 + 搜索过滤 + jsonrepair 容错解析（model/parse 纯逻辑有测试）
  lib/
    llm/client.ts                # streamCompletion：createOpenAI + streamText 流式封装
    llm/types.ts
    markdown/sanitize.ts         # 共享 rehype-sanitize schema
    markdown/MarkdownPreview.tsx # 唯一的 Markdown 渲染入口（已内置 sanitize）
    utils.ts                     # shadcn 的 cn()
  stores/
    settings.ts                  # zustand + persist → localStorage（endpoint/apiKey/model）
    resume.ts                    # zustand + persist → localStorage（简历 markdown 源）
  test/setup.ts                  # vitest + jest-dom
```

> 注意：shadcn 用的是 **Base UI** 底座（不是 Radix），Trigger/Close 等用 `render={<El/>}` 属性，
> 没有 `asChild`。

## 命令

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 启动本地开发服务器（Vite） |
| `pnpm build` | 类型检查（`tsc -b`）+ 构建静态产物到 `dist/` |
| `pnpm preview` | 本地预览构建产物 |
| `pnpm lint` | Biome 检查（lint + format 校验）。`src/components/ui/**` 与 `*.css` 不纳入 lint |
| `pnpm format` | Biome 按规则格式化并写回 |
| `pnpm test` | 运行 Vitest（`pnpm test run` 单次跑完退出） |

## 工作方式

- 组件级改动：直接实现 + 用 Playwright 打开页面截图/看 console 迭代，别先写长 plan。
- 需要 plan mode 的场景：① 项目脚手架与目录结构；② 简历的数据模型 + 打印样式方案（返工成本高）。
- 简历页视觉：值得走一遍 design token 流程（`artifact-design`），避免出来「像模板」。
