# Cloudflare Workers 部署指南

auwe 使用 React + Vite 构建静态 SPA，由 Workers Static Assets 分发；TypeScript Worker 处理同源 `/api/*`。

本指南介绍开发检查、Worker 发布、运行时配置、访问验证和 `auwe.app` 域名绑定。

## 开发与检查

使用 Node.js 24、pnpm 12.18.0：

```bash
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm-workspace.yaml` 允许 `esbuild` 和 `workerd` 执行安装脚本；`pnpm-lock.yaml` 锁定依赖版本。安装依赖时使用这两份配置。

`pnpm dev` 同时启动 Vite 和 `127.0.0.1:8787` 上的 Wrangler，Vite 将 `/api` 请求代理到 Worker。退出时会停止两个进程。开发模式用 `public/` 作为 Worker 的资源目录，不需要预先构建 `dist/`。

Vite 负责前端开发和构建，Vitest 负责单元测试。生产部署与构建预览由 Wrangler 按 `wrangler.jsonc` 执行。

如需测试官方试用，将 `.dev.vars.example` 复制为 `.dev.vars`，填入测试端点和密钥。该文件已忽略提交。不要将密钥放入 `VITE_*` 变量。

```bash
pnpm cf:types
pnpm lint
pnpm test run
pnpm build
pnpm preview
```

修改 Worker 绑定、兼容日期或 flags 后，执行 `pnpm cf:types` 并提交 `worker-configuration.d.ts`。兼容日期为 `2026-11-04`，升级时与 Wrangler/workerd 一起验证。

## 创建并发布 Worker

支持命令行发布和 GitHub 自动部署两种方式。

### 方式一：命令行发布

在项目根目录、可访问 Cloudflare 的终端执行：

```bash
pnpm install --frozen-lockfile
pnpm exec wrangler login
pnpm exec wrangler whoami
pnpm deploy
```

`wrangler login` 登录的是 Cloudflare；`whoami` 用于核对部署用户和可访问的账户。选择存放 `auwe.app` 域名的 Cloudflare 账户；如果拥有多个账户，可在 `wrangler.jsonc` 设置目标账户的 `account_id`，明确发布位置。

`pnpm deploy` 构建项目并按 `wrangler.jsonc` 发布名为 `auwe` 的 Worker；Worker 不存在时会自动创建。发布成功后，使用终端输出的 `workers.dev` 地址验证。命令行发布使用 Cloudflare 登录授权，更新时执行同一命令。

### 方式二：连接 GitHub 自动部署

1. 在 Cloudflare 的 **Workers & Pages → Create application → Continue with GitHub** 中连接 `amching/auwe`。
2. 在创建页面填写以下配置并部署：

| 配置项 | 值 |
|---|---|
| Worker 名称 | `auwe`，与 `wrangler.jsonc` 一致 |
| 仓库 | `amching/auwe` |
| 生产分支 | `main` |
| 项目根目录 | 仓库根目录 |
| 构建命令 | `pnpm build` |
| 部署命令 | `pnpm exec wrangler deploy` |
| Node.js 版本 | `24`，仓库提供 `.nvmrc` |
| pnpm 版本 | `12.18.0` |

依赖按仓库的 `pnpm-lock.yaml` 和 `pnpm-workspace.yaml` 安装。Workers Builds 分别执行构建命令和部署命令。连接成功后，推送到 `main` 会触发自动部署。

GitHub Actions `Checks` 负责检查、构建和 `wrangler deploy --dry-run`；线上自动部署由 Workers Builds 执行。

`wrangler.jsonc` 启用 `workers.dev`，正式域名按下文配置。Version URLs 默认关闭。

## 配置官方试用通道（可选）

需要免 Key 试用时，在 **Worker → Settings → Variables and Secrets** 中配置运行时变量：

| 名称 | 内容 |
|---|---|
| `TRIAL_ENDPOINT` | OpenAI 兼容的试用端点，通常以 `/v1` 结尾 |
| `TRIAL_API_KEY` | 服务端使用的试用密钥；类型选择 Secret |
| `TRIAL_MODEL` | 固定模型 id |
| `TRIAL_PROVIDER` | 可选展示名称 |

这些变量在 Worker 运行时读取，应配置在 **Variables and Secrets** 中。本地 `.dev.vars` 用于本地开发，生产环境单独配置。

也可以通过 `pnpm exec wrangler secret put <名称>` 的交互输入设置，避免把值写进命令历史。密钥从模型服务商或自己的密钥管理工具取得。不要将密钥粘贴到代码或聊天里。

没有配置时，`GET /api/trial` 返回 JSON 503；这代表试用通道未启用，BYOK 不受影响。测试环境用独立的低额度密钥。

## 发布验证

在 `workers.dev` 地址验证以下行为：

- 首页及 `/resume`、`/polish`、`/tools/json` 等深层路由可直接打开和刷新。
- 简历编辑、PDF 打印预览、工具页面和本地草稿可正常使用。
- `GET /api/missing` 返回 JSON 404，直接在浏览器打开也不能返回 SPA HTML。
- 试用未配置时返回 503；配置后只返回公开的 provider/model，不返回密钥或端点全文。
- 试用生成逐步流式输出；BYOK 从浏览器直连用户所选端点。
- `/assets/*` 使用长期不可变缓存；HTML 重新验证；API 使用 `no-store`。
- 服务端密钥没有出现在 `dist/`、网络响应或日志中。

设置和草稿保存在浏览器的 localStorage 中，按来源隔离。`workers.dev` 与 `https://auwe.app` 各自使用独立的本地数据。

## 绑定正式域名 auwe.app

1. 确认 `workers.dev` 验证通过，且 `auwe.app` 所在的 Cloudflare 域名区域处于 Active 状态。
2. 确认 DNS 中 `auwe.app` 对应的主机名没有冲突的 CNAME 记录，这是创建 Worker Custom Domain 的前提。
3. 在 **Worker → Settings → Domains & Routes → Add → Custom Domain** 中填写 `auwe.app`。Cloudflare 会创建所需 DNS 记录并签发证书。
4. 等待域名和证书生效，在 `https://auwe.app` 验证页面、深层路由、API 和浏览器草稿。
5. 检查 `www.auwe.app` 的 DNS 和重定向规则；如需 `www` 跳转到根域名，配置并验证它跳转到 `https://auwe.app`，同时保留路径和查询参数。

域名可用后，将正式 Custom Domain 写入 `wrangler.jsonc` 的顶层 `routes`，让后续发布配置可追溯：

```json
{
  "routes": [{ "pattern": "auwe.app", "custom_domain": true }]
}
```

## 后续发布

- 命令行方式执行 `pnpm deploy`；已连接 Workers Builds 时，推送到 `main` 自动部署。
- 每次发布后检查首页、懒加载页面、深层路由刷新和 API。`src/lib/chunkReload.ts` 处理部署后动态分包加载失败的自动重载。
- Worker 配置变更时同步更新 `wrangler.jsonc`；绑定或运行时类型变化后执行 `pnpm cf:types`。

## 官方资料

- [通过命令行创建 Worker](https://developers.cloudflare.com/workers/get-started/guide/)
- [Static Assets 绑定](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Workers Builds 配置](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
