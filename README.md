# auwe

> 一套帮你写好简历、写好职场语言的纯客户端工具站。你的 API Key 只留在你自己的浏览器里。

**auwe** 是一个开箱即用的静态 Web 应用，包含三个职场向工具：

- 📄 **简历** — 用 Markdown 写简历，实时渲染成优雅的排版，一键打印成 PDF。接入你自己的 AI 端点后，可对内容做润色和提出修改建议。
- ✍️ **文风** — 帮你润色职场语言、把模糊的描述改写成可量化的成果，成为更好的职场写手。
- 🧰 **工具** — 常用小工具集合（时间戳转换等）。

## ✨ 特点

- **隐私优先（BYOK）**：AI 能力由你自己的 Endpoint + API Key 驱动，调用**直接从浏览器发出**，密钥只存在本地浏览器，绝不上传到任何服务器。
- **无需注册、无后端**：纯静态站，打开即用。
- **优雅简历，矢量 PDF**：基于浏览器原生打印，导出的 PDF 文字清晰、可选中、可搜索。
- **流式 AI 反馈**：润色和建议实时逐字输出。

## 🚀 快速开始

```bash
pnpm install
pnpm dev
```

> 命令与实际脚本以 `package.json` 为准（项目脚手架落地后补充完整命令表）。

## 🔑 配置 AI 能力

在应用的「设置」中填入：

- **Endpoint**：任意 OpenAI 兼容的 API 地址（也支持 Anthropic 等）。
- **API Key**：你自己的密钥。

> Key 仅保存在浏览器 `localStorage`，不会离开你的设备。
> 若你的端点未开启 CORS，可在部署时启用可选的代理函数。

## 🛠️ 技术栈

Vite · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Zustand · Vercel AI SDK · CodeMirror 6 · react-markdown

## 📦 部署

静态产物可部署到任意静态托管（Cloudflare Pages / Vercel 等）。

```bash
pnpm build
```

## 📄 License

MIT
