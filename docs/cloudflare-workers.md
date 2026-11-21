# Cloudflare Workers 部署与 Pages 迁移

auwe 使用 React + Vite 构建静态 SPA，由 Workers Static Assets 分发；TypeScript Worker 处理同源 `/api/*`。当前没有数据库，也没有引入分享功能。

## 开发与检查

使用 Node.js 24、pnpm 12.18.0：

```bash
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` 同时启动 Vite 和 `127.0.0.1:8787` 上的 Wrangler，Vite 将 `/api` 请求代理到 Worker。退出时会停止两个进程。开发模式用 `public/` 作为 Worker 的资源目录，不需要预先构建 `dist/`。

采用 Vite + Wrangler 的独立开发方式，保留现有 Vite/Vitest 配置与构建输出；无需增加 Cloudflare Vite 插件。生产与构建预览都由 Wrangler 按同一份 `wrangler.jsonc` 执行。

如需测试官方试用，将 `.dev.vars.example` 复制为 `.dev.vars`，填入测试端点和密钥。该文件已忽略提交。不要将密钥放入 `VITE_*` 变量。

```bash
pnpm cf:types
pnpm lint
pnpm test run
pnpm build
pnpm preview
```

修改 Worker 绑定、兼容日期或 flags 后，重新执行 `pnpm cf:types` 并提交 `worker-configuration.d.ts`。兼容日期固定为与当前锁定的 Wrangler/workerd 版本一致的 `2026-11-04`，升级时一起验证。

## 创建 Workers 项目

1. 在 Cloudflare 的 Workers & Pages 中创建新的 **Workers** 项目，连接当前 Git 仓库。
2. 项目名称设为 `auwe`，必须与 `wrangler.jsonc` 一致。Pages 与 Workers 是不同产品，可以分别保留同名项目。
3. 生产分支选择 `main`，构建命令填写 `pnpm build`，部署命令填写 `pnpm exec wrangler deploy`。
4. Node.js 版本使用 24。依赖按 `pnpm-lock.yaml` 安装。
5. 第一次部署后，先使用 Cloudflare 分配的 `workers.dev` 地址验证。先保留 Pages 的正式域名。

也可以在已登录且联网的终端执行：

```bash
pnpm exec wrangler login
pnpm exec wrangler whoami
pnpm deploy
```

`pnpm deploy` 会先构建，再发布。Workers Builds 已有单独构建步骤，所以它的部署命令直接使用 `pnpm exec wrangler deploy`，避免重复构建。

默认不在代码中绑定正式域名，以免第一次验证部署直接抢占 Pages 入口。Version URLs 默认关闭；如以后启用分支预览，单独配置测试密钥和存储绑定，不要把生产 Version URL 当作隔离环境。

## 迁移试用配置

Pages 项目的变量和加密 Secret 不会自动复制到 Worker。若原站启用了官方试用，需要在新的 Worker → Settings → Variables and Secrets 中重新填写：

| 名称 | 内容 |
|---|---|
| `TRIAL_ENDPOINT` | 原试用端点，通常以 `/v1` 结尾 |
| `TRIAL_API_KEY` | 原试用密钥或重新申请的低额度密钥；选择 Secret |
| `TRIAL_MODEL` | 固定模型 id |
| `TRIAL_PROVIDER` | 可选展示名称 |

也可以通过 `pnpm exec wrangler secret put <名称>` 的交互输入设置，避免把值写进命令历史。Cloudflare 的加密密钥通常无法回读，需从原密钥来源重新取得。不要将密钥粘贴到代码或聊天里。

没有配置时，`GET /api/trial` 返回 JSON 503；这代表试用通道未启用，BYOK 不受影响。测试环境用独立的低额度密钥。

## 切换前验证

在 `workers.dev` 地址验证以下行为：

- 首页及 `/resume`、`/polish`、`/tools/json` 等深层路由可直接打开和刷新。
- 简历编辑、PDF 打印预览、工具页面和已有本地草稿可正常使用。
- `GET /api/missing` 返回 JSON 404，直接在浏览器打开也不能返回 SPA HTML。
- 试用未配置时返回 503；配置后只返回公开的 provider/model，不返回密钥或端点全文。
- 试用生成逐步流式输出；BYOK 仍从浏览器直连用户所选端点。
- `/assets/*` 使用长期不可变缓存；HTML 重新验证；API 使用 `no-store`。
- 服务端密钥没有出现在 `dist/`、网络响应或日志中。

测试域名与 `auwe.app` 的浏览器存储互相隔离。在 `workers.dev` 看不到原草稿是正常现象；切回相同正式域名后仍访问原来的 localStorage。

## 正式域名切换

1. 确认上述检查通过，记录旧 Pages 的默认地址、绑定域名和 DNS 状态。
2. 暂停旧 Pages 的生产自动部署，避免它继续发布旧构建。
3. 从 Pages 解除 `auwe.app` 的自定义域名绑定。Cloudflare 不允许 Worker Custom Domain 与已有的冲突 CNAME 共存；核对并处理该域名对应的旧 Pages CNAME，保留其他 DNS 记录。
4. 在 Worker → Settings → Domains & Routes 中添加 `auwe.app` 为 Custom Domain，等待证书和路由生效。这个切换可能出现短暂中断。
5. 在正式域名重新验证页面、接口、缓存和浏览器草稿。若有 `www` 跳转，验证它仍跳转到 `auwe.app`。
6. 在验证完成前保留旧 Pages 项目。确认稳定后再决定是否删除。

域名可用后，将正式 Custom Domain 写入 `wrangler.jsonc` 的 `routes`，例如 `[{ "pattern": "auwe.app", "custom_domain": true }]`，让后续发布配置可追溯。只有确认正式接管后才添加。

## 回滚

- **代码回滚**：在 Worker 的 Deployments 选择此前稳定版本，或运行 `pnpm exec wrangler rollback`。此次没有新增数据库或存储迁移。
- **迁移回滚**：如果 Workers 域名切换后出现问题，解除 Worker 的域名绑定，按记录的原配置重新绑定 Pages，恢复旧站入口。
- Worker 代码回滚不会回滚外部资源和数据；后续引入存储时应单独制定数据兼容策略。
- 静态资源版本切换可能导致旧页面请求旧分包。保留现有 `src/lib/chunkReload.ts` 自愈逻辑，并在发布后验证懒加载页面。

## 官方资料

- https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/
- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- https://developers.cloudflare.com/workers/ci-cd/builds/
