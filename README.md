<div align="center">

# A·U·WE

**职场 AI 工具站 · 纯客户端 · 自带 Key（BYOK）**

写好简历、写好汇报、拆解 Prompt——你的 API Key 只留在你自己的浏览器里，永不上传。

[![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](#-license)

</div>

---

**auwe** 是一个开箱即用的静态 Web 应用，把一组高频的职场写作场景和开发者小工具收进同一个站点。所有 AI 能力都由**你自己的模型端点**驱动，调用**直接从浏览器发出**，密钥只存在本地——没有账号、没有后端、没有数据上送。

## 📚 功能一览

| 模块 | 能做什么 |
|---|---|
| 📄 **简历** | 用 Markdown 写简历，实时渲染成 A4 分页预览，浏览器原生打印导出**矢量 PDF**（文字可选中、可搜索）；内置视觉模板；接入 AI 后可对选区 / 段落 / 章节 / 全文提出润色建议，并在编辑器内以 **Diff 审阅**，接受才写回。 |
| 🧩 **解构** | 粘贴一段长 Prompt，AI 把它拆解成**核心意图 → 逻辑结构 → 核心思想 → 可复用骨架**；原文片段与结构节点双向高亮联动，且所有摘录都会**逐字定位回原文**，定位不到即丢弃（反幻觉）。 |
| ✍️ **文风** | 把零散的工作记录整理成规范汇报：**日报 / 周报 / 季度汇报**三档场景，五级润色刻度（朴实→浮夸，只改表达强度、不改事实）。内建**事实红线**杜绝虚构成果，流式逐字输出。 |
| 🧰 **工具** | 常用小工具集合，⌘K 命令面板一键直达：**时间戳转换**、**JSON 格式化 / 查看**、**类型定义生成**（JSON/YAML/TOML/CSV → TS/Go/Rust）、**人生设计师**（斯坦福人生设计课 AI 教练）。 |

## ✨ 为什么是它

- **🔐 隐私优先（BYOK）** — AI 由你自己的 Endpoint + API Key 驱动，请求直连你的端点，密钥只写入浏览器 `localStorage`，绝不经过我们的服务器。
- **🎁 免 Key 也能体验** — 部署方可选配置「官方试用通道」，访客无需自带 Key 即可试用；托管密钥全部留在服务端，**绝不进前端 bundle**。
- **🖨️ 矢量 PDF** — 简历导出走浏览器原生打印，而非把文字栅格化成图片，成品清晰、可选、可搜索。
- **🛡️ 安全渲染** — 所有 Markdown（包括 LLM 返回的内容）一律经 `rehype-sanitize`，同页存着 API Key，XSS 无从下手。
- **📡 流式输出** — 润色、建议、汇报生成均为实时逐字流式，反馈即时。
- **🪶 纯静态、免注册** — 无传统后端、无数据库，打开即用，可部署到任意静态托管。

## 🚀 快速开始

**环境要求**：Node.js ≥ 20 · [pnpm](https://pnpm.io) ≥ 9

```bash
git clone https://github.com/amching/auwe.git
cd auwe
pnpm install
pnpm dev
```

打开终端提示的本地地址即可。首次使用请在应用右上角「设置」里填入你的 AI 配置（见下）。

> 本地 `pnpm dev` 没有边缘函数，官方试用通道会自动探测为不可用——填入自己的 Key 即可正常使用全部 AI 功能。

## 📜 常用命令

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 启动本地开发服务器（Vite） |
| `pnpm build` | 类型检查（`tsc -b`）+ 构建静态产物到 `dist/` |
| `pnpm preview` | 本地预览构建产物 |
| `pnpm lint` | 代码检查（Biome，lint + format 校验） |
| `pnpm format` | 按规则格式化并写回（Biome） |
| `pnpm test` | 运行单元测试（Vitest），`pnpm test run` 单次跑完退出 |

## 🔑 配置 AI 能力

在应用的「设置」中填入：

- **Endpoint** — 任意 OpenAI 兼容的 API 地址（也支持 Anthropic 等）。
- **API Key** — 你自己的密钥。
- **Model** — 要调用的模型 id（如 `gpt-4o-mini`）。

> - 密钥仅保存在浏览器 `localStorage`，不会离开你的设备。
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
| 部署 | Cloudflare Pages / Vercel（保留 edge function 位） |

## 📁 项目结构

```text
functions/api/trial/   Cloudflare Pages Function：可选的官方试用通道代理
src/
  pages/               简历 / 解构 / 文风 / 工具 四大模块
  components/           布局与 shadcn/ui 组件
  lib/                  LLM 客户端 · Markdown 渲染与 sanitize · 工具函数
  stores/               Zustand 持久化状态
```

## 🚢 部署

产物是纯静态文件，可托管到任意静态平台（Cloudflare Pages / Vercel 等）：

```bash
pnpm build   # 产物在 dist/
```

**可选：官方试用通道 / CORS 代理。** `functions/api/trial/[[path]].ts` 是一个 Cloudflare Pages Function，让访客免 Key 体验。它读取以下服务端环境变量，密钥永不进前端：

| 变量 | 说明 |
|---|---|
| `TRIAL_ENDPOINT` | 试用通道使用的 OpenAI 兼容端点 |
| `TRIAL_API_KEY` | 试用通道密钥（仅在服务端） |
| `TRIAL_MODEL` | 服务端钉死的模型 id |
| `TRIAL_PROVIDER` | *（可选）* 展示用的提供方名称 |

不配置这些变量时，应用只走 BYOK，一切照常。

## 🔒 安全与隐私

- 用户的 API Key 只进 `localStorage`，**不写入**日志、URL query 或任何会离开浏览器的地方。
- 托管的试用密钥只存在于 Cloudflare 环境变量，**绝不进前端 bundle**。
- 用户输入与 LLM 返回的 Markdown 都视为不可信内容，渲染前统一经过 `rehype-sanitize`。

## 📄 License

[MIT](./LICENSE)
