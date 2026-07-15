# auwe

一个纯客户端（静态 SPA）的职场工具站，三个页面：

1. **简历（Resume）** — 用 Markdown 编写，实时渲染成优雅的简历；支持用户传入 Endpoint + API_KEY，对内容做润色 / 提建议，用户依据建议手动改 Markdown。
2. **文风（Polish）** — 帮用户润色职场语言、把工作量量化，成为更好的职场写手。
3. **工具（Tools）** — 常用小工具集合（时间戳转换等）。

## 核心架构原则（改动前必须理解）

- **纯客户端 BYOK**：LLM 调用**从浏览器直接发出**，API_KEY 只存在用户本地（localStorage），永不上送到我们的服务器。这是隐私卖点，不要引入需要托管密钥的后端。
- 无传统后端、无数据库、无 SEO 需求 → 静态部署（Cloudflare Pages / Vercel）。
- 需要服务端能力时，只用 edge function。现有用途：**官方试用通道代理**（`functions/api/trial/`，用户没配 BYOK 时兜底）；预留用途：CORS 代理（见下）。
- **试用通道**：试用的 endpoint/key/model 全部存在 Cloudflare 环境变量（`TRIAL_ENDPOINT` / `TRIAL_API_KEY` / `TRIAL_MODEL` / 可选 `TRIAL_PROVIDER`），前端只知道同源路径 `/api/trial`。**任何托管密钥都不得进前端 bundle**——「内嵌但不显示」不算隐藏，DevTools 一眼可见。配置解析统一走 `src/lib/llm/trial.ts` 的 `resolveLlm()`（BYOK 优先，试用兜底）；本地 `pnpm dev` 没有 edge function，试用通道自然探测为不可用。

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
functions/
  api/trial/[[path]].ts          # Cloudflare Pages Function：试用通道代理（GET 探测 / POST chat/completions 流式透传；model 服务端钉死 + max_tokens 封顶）
src/
  main.tsx                       # 挂载 <App/>（StrictMode + createRoot）
  App.tsx                        # createBrowserRouter：根布局 + 路由（/ 占位首页待做、/resume、/prompt、/polish、/tools；页面级 lazy code-split）
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
      sampleResume.ts            # 默认模板 + 完整示例 + 旧教学注释迁移指纹（stripLegacyTutorialComment）
      FormatGuideDialog.tsx      # 格式指南弹窗（4 条约定 + 完整示例双视图）；教程属 UI，不进简历正文
      ai/                        # AI 优化：选区/段落/章节/全文 → 流式建议 → 编辑器内 Diff 审阅 → 接受才写回
        store.ts                 # 会话状态机（zustand 非持久化）：idle/streaming/reviewing/applied；apply() 是唯一写回 useResume 的路径
        diff.ts                  # token 级 LCS diff（中文按字、英文按词；纯逻辑有测试）
        scope.ts                 # Markdown 结构范围识别：面包屑 + 段落/章节取范围（纯逻辑有测试）
        prompts.ts               # 快捷指令 + prompt 组装
        diffExtension.ts         # CM6 Diff 装饰：del 划线 mark + add widget，文档本身不动
        SelectionToolbar.tsx     # 选中文字后的浮动工具条（AI 优化 / 精简 / 更专业 / 强化成果）
        AiPanel.tsx              # 右栏 AI 面板：范围 + 原文卡 + 快捷指令 + 对话 + 建议卡（应用/继续调整/放弃）
    polish/PolishPage.tsx        # 文风（已跑通的流式润色竖切片）
    prompt/                      # Prompt 解构（/prompt）：粘贴长 Prompt → AI 拆成意图/结构/思想/可复用骨架
      PromptPage.tsx             # 双栏工作台：左原文编辑器 / 右解构结果；原文片段↔结构节点双向联动
      ResultPanel.tsx            # 右栏四态（空/骨架屏/错误/成功）：核心意图→逻辑结构→结构详情→核心思想→骨架
      analysis.ts                # 解析校验 + 反幻觉片段定位：AI 摘录须逐字定位到原文，否则丢弃（纯逻辑有测试）
      highlight.ts               # CM6 片段高亮扩展：mark 装饰 + 点击命中回调 + 滚动定位
      prompts.ts                 # 解构提示词组装（<user_prompt> 边界防注入）
      samplePrompt.ts            # 「使用示例」内置 Prompt
      useDeconstruct.ts          # 请求状态机（status/error 瞬态；结果写入 stores/prompt 持久化）
    tools/
      registry.ts                # 工具注册表：单一事实源（网格/⌘K 面板/路由都读它；新工具往这里加）
      ToolsLayout.tsx            # 工具区外壳：⌘K 命令面板 + 子路由
      ToolsPage.tsx              # 工具网格首页
      ToolView.tsx               # 工具专注视图 /tools/:slug（wide 工具放宽容器）
      Segmented.tsx              # 工具区共享的分段单选控件
      ToolbarSelect.tsx          # 工具区共享的工具条紧凑下拉单选（只显示当前选中项）
      cmTheme.ts                 # 工具区共享的 CodeMirror 主题 + 通用代码高亮
      timestamp/                 # 时间戳 ⇄ 日期时间（多时区）
      json/                      # JSON 格式化/查看：CodeMirror 源码编辑 + 虚拟化树视图 + 搜索过滤 + jsonrepair 容错解析（model/parse 纯逻辑有测试）
      typegen/                   # 类型定义生成：JSON/YAML/TOML/CSV → TS/Go/Rust（parseInput/infer/emit 纯逻辑有测试；Go json tag/omitempty/指针、Rust serde 可配）
  lib/
    llm/client.ts                # streamCompletion：createOpenAI + streamText 流式封装
    llm/types.ts
    llm/trial.ts                 # 试用通道：探测 /api/trial（useTrialChannel）+ resolveLlm()（BYOK 优先，试用兜底）
    llm/errors.ts                # describeLlmError：LLM 异常 → 可行动中文（接口层失败 vs 内容为空要分清；纯逻辑有测试）
    markdown/sanitize.ts         # 共享 rehype-sanitize schema
    markdown/MarkdownPreview.tsx # 唯一的 Markdown 渲染入口（已内置 sanitize）
    utils.ts                     # shadcn 的 cn()
  stores/
    settings.ts                  # zustand + persist → localStorage（endpoint/apiKey/model）
    resume.ts                    # zustand + persist → localStorage（简历 markdown 源）
    prompt.ts                    # zustand + persist → localStorage（解构页草稿 + 最近一次解构结果，成对存取）
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
