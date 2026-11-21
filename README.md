<div align="center">

# A·U·WE

**职场 AI 工具站 · 浏览器优先 · 自带 Key（BYOK）**

写好简历、写好汇报、用好工具——你的 API Key 保存在自己的浏览器中，直接用于调用你选择的模型端点。

[![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](#-license)

</div>

---

**auwe** 是一个开箱即用的静态 Web 应用，把一组高频的职场写作场景和开发者小工具收进同一个站点。所有 AI 能力都由**你自己的模型端点**驱动，调用**直接从浏览器发出**，密钥只存在本地——无需账号，草稿保存在本地；可选的官方试用接口由 Cloudflare Worker 承载。

## 📚 功能一览

| 模块 | 能做什么 |
|---|---|
| 📄 **简历** | 用 Markdown 写简历，实时渲染成 A4 分页预览，浏览器原生打印导出**矢量 PDF**（文字可选中、可搜索）；内置视觉模板；接入 AI 后可对选区 / 段落 / 章节 / 全文提出润色建议，并在编辑器内以 **Diff 审阅**，接受才写回。 |
| ✍️ **文风** | 把零散的工作记录整理成规范汇报：**日报 / 周报 / 季度汇报**三档场景，五级润色刻度（朴实→浮夸，只改表达强度、不改事实）。内建**事实红线**杜绝虚构成果，流式逐字输出。 |
| 🧰 **工具** | 常用小工具集合，⌘K 命令面板一键直达：**时间戳转换**、**JSON 格式化 / 查看**、**类型定义生成**（JSON/YAML/TOML/CSV → TS/Go/Rust）、**人生设计师**（斯坦福人生设计课 AI 教练）。 |

## ✨ 为什么是它

- **🔐 隐私优先（BYOK）** — AI 由你自己的 Endpoint + API Key 驱动，请求直连你的端点，密钥只写入浏览器 `localStorage`，绝不经过我们的服务器。
- **🎁 免 Key 也能体验** — 部署方可选配置「官方试用通道」，访客无需自带 Key 即可试用；托管密钥全部留在服务端，**绝不进前端 bundle**。
- **🖨️ 矢量 PDF** — 简历导出走浏览器原生打印，而非把文字栅格化成图片，成品清晰、可选、可搜索。
- **🛡️ 安全渲染** — 所有 Markdown（包括 LLM 返回的内容）一律经 `rehype-sanitize`，同页存着 API Key，XSS 无从下手。
- **📡 流式输出** — 润色、建议、汇报生成均为实时逐字流式，反馈即时。
- **🪶 轻量、免注册** — 静态前端 + 按需执行的 Worker API，无常驻服务器、无数据库。

## 🚀 快速开始

**环境要求**：Node.js ≥ 22.12（推荐 24） · [pnpm](https://pnpm.io) 12.18.0

```bash
git clone https://github.com/amching/auwe.git
cd auwe
pnpm install
pnpm dev
```

打开终端提示的本地地址即可。首次使用请在应用右上角「设置」里填入你的 AI 配置（见下）。

> `pnpm dev` 同时启动 Vite 和本地 Worker。试用配置可填写到 `.dev.vars`（参考 `.dev.vars.example`）；不配置时使用自己的 Key 即可。

## 📜 常用命令

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 同时启动 Vite（前端）与 Wrangler（Worker API） |
| `pnpm build` | 类型检查（`tsc -b`）+ 构建静态产物到 `dist/` |
| `pnpm preview` | 通过 Wrangler 预览构建产物和 Worker API |
| `pnpm deploy` | 构建并发布到 Cloudflare Workers |
| `pnpm cf:types` | 生成 Worker 绑定与运行时类型 |
| `pnpm lint` | 代码检查（Biome，lint + format 校验） |
| `pnpm format` | 按规则格式化并写回（Biome） |
| `pnpm test` | 运行单元测试（Vitest），`pnpm test run` 单次跑完退出 |

## 🔑 配置 AI 能力

在应用的「设置」中填入：

- **Endpoint** — 任意 OpenAI 兼容的 API 地址（也支持 Anthropic 等）。
- **API Key** — 你自己的密钥。
- **Model** — 要调用的模型 id（如 `gpt-4o-mini`）。

> - 密钥保存在浏览器 `localStorage`，仅在调用时发送给你配置的模型端点，不经过站点后端。
> - **Anthropic 端点**需要浏览器直连，应用会自动附带 `anthropic-dangerous-direct-browser-access` 头。
> - 若你的端点未开启 CORS，可在部署时启用可选的代理 / 试用边缘函数。

## 🏗️ 技术栈

| 层 | 选型 |
|---|---|
| 构建 | Vite |
| 框架 | React 19 + TypeScript（strict） |
| 路由 | React Router v7 |
| 样式 | Tailwind v4 + shadcn/ui（Base UI 底座） |
| 状态 | Zustand（`persist` 持久化设置与草稿到 `localStorage`） |
| LLM 调用 | Vercel AI SDK（`ai` + `@ai-sdk/openai`，自定义 `baseURL`，`streamText` 流式） |
| Markdown | CodeMirror 6（编辑）· react-markdown + remark-gfm + **rehype-sanitize**（渲染） |
| 工具链 | Biome（lint + format）· Vitest（测试） |
| 部署 | Cloudflare Workers Static Assets + TypeScript Worker |

## 📁 项目结构

```text
worker/               Worker API：路由、可选的官方试用通道代理
wrangler.jsonc        Cloudflare Workers 部署配置
scripts/dev.mjs       前端与本地 Worker 的联合启动入口
src/
  pages/                简历 / 文风 / 工具 三大模块
  components/           布局与 shadcn/ui 组件
  lib/                  LLM 客户端 · Markdown 渲染与 sanitize · 工具函数
  stores/               Zustand 持久化状态
```

## 🚢 部署

项目部署到 **Cloudflare Workers**：静态资源由 Static Assets 分发，`/api/*` 由 Worker 处理，前端深层路由回退到 `index.html`。

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm preview               # 本地验证实际 Worker 和 dist/ 静态产物
pnpm exec wrangler login   # 首次授权 Cloudflare 账号
pnpm deploy                # 构建并发布名为 auwe 的 Worker
```

连接 Git 仓库时，在 Cloudflare 创建 **Workers 项目**，构建命令填 `pnpm build`，部署命令填 `pnpm exec wrangler deploy`。不要继续使用旧 Pages 项目的构建输出目录设置。

**可选：官方试用通道。** `worker/trial.ts` 读取服务端环境变量，前端继续使用同源 `/api/trial`，托管密钥不进入前端构建产物：

| 变量 | 说明 |
|---|---|
| `TRIAL_ENDPOINT` | OpenAI 兼容端点 |
| `TRIAL_API_KEY` | 仅服务端使用的试用密钥，必须作为 Secret 配置 |
| `TRIAL_MODEL` | 服务端固定的模型 id |
| `TRIAL_PROVIDER` | 可选的展示用提供方名称 |

不配置时试用接口返回 503，BYOK 功能照常可用。Pages 的变量和 Secret 不会自动迁入 Workers。

完整的首次发布、密钥迁移、`auwe.app` 域名切换和回滚步骤见 [Cloudflare Workers 部署指南](docs/cloudflare-workers.md)。

## 🔒 安全与隐私

- 用户的 API Key 存入 `localStorage`，调用时直连所选模型端点；不写入日志、URL query，不经过站点后端。
- 托管的试用密钥只存在于 Cloudflare 环境变量，**绝不进前端 bundle**。
- 用户输入与 LLM 返回的 Markdown 都视为不可信内容，渲染前统一经过 `rehype-sanitize`。

## 📄 License

[MIT](./LICENSE)
