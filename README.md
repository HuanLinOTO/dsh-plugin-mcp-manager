[![dshfind](https://dshfind.com/api/badge/huanlinoto/dsh-plugin-mcp-manager?lang=zh)](https://dshfind.com/zh/plugins/huanlinoto/dsh-plugin-mcp-manager?ref=badge)

> 📌 本插件已收录于 [dshfind](https://dshfind.com/zh) 插件超市，点击上方徽章直达主页。

# dsh-mcp-manager

> DSH MCP 服务器管理插件 — GUI 增删改 MCP 服务器配置 + 工具浏览 + agent 面 `mcp_*` 管理工具。

## 定位

**服务器连接管理 + 工具浏览**。连接生命周期完全委托官方 `@deepseek-ai/dsh-mcp-client`——
本插件是注册表的「写配置层」+「状态/工具浏览层」，不自己拉连接。

```
GUI(settings.section「MCP」) ──HTTP──> /api/mcp-manager ──读写──> profile cordis.patch.yml
Agent 面 mcp_* 工具 ─────────────────────────────┘        (mcp-client insert 行)
                                                              │ 配置 HMR 实时挂载
                                                              ▼
                                                官方 mcp-client 实例（连接+注册工具）
GUI 状态/工具浏览 <──ctx.tools.schemas() 过滤 mcp__──┘
```

每台 MCP 服务器 = profile `cordis.patch.yml` 中一条 `name: '@deepseek-ai/dsh-mcp-client'` 的
insert 行。配置 HMR 实时挂载/卸载/热替换，无需重启 web。

## 开发

### 依赖

```powershell
pnpm install
```

`@deepseek-ai/*` peer deps 从公共 npm registry 解析（已发布）。`yaml`（eemeli）是唯一运行时依赖。

### 三件套

```powershell
pnpm typecheck   # tsc --noEmit（src/ + tests/；src/client/ 由 tsdown 构建，不进 tsc）
pnpm test        # vitest run（registry 单元测试，27 用例）
pnpm build       # tsdown 双 bundle：lib/index.mjs（Node half）+ lib/index.js（client half）
```

### 架构

| 文件 | 职责 |
|------|------|
| `src/registry.ts` | 服务器注册表：eemeli `yaml` Document API 读写 insert 行 + `loadOverlayPatches` 校验 + serverName 唯一 |
| `src/tools.ts` | agent 面 `mcp_*` ×4 工具（defineTool，规范 JSON 输出） |
| `src/index.ts` | Node half：`/api/mcp-manager` 路由 + `ctx.tools.schemas()` 过滤 + mcp 工具注册 |
| `src/client/index.ts` | client half：`settings.section` 注册「MCP」面板 |
| `src/client/Panel.tsx` | 面板 UI：服务器列表 + 增删改表单 + 工具浏览 |

### 数据模型

存储 = profile `cordis.patch.yml` 的 mcp-client insert 行（单一事实来源）：

```yaml
- insert:
    - id: mcp-github          # 行 id（mcp-<serverName>）
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: github    # 工具命名空间 mcp__github__*
        transport: stdio      # stdio | streamable-http
        command: npx
        args: ['-y', '@modelcontextprotocol/server-github']
        env: { GITHUB_TOKEN: '' }        # 明文（见下「Secret 处理」）
        toolCallTimeoutMs: 60000
        failOnStartupError: false
```

- 支持 `stdio`（command/args/env/cwd）与 `streamable-http`（url/headers）。
- 编辑 = 整块替换 config（不深合并，与 loader patch 语义一致）。
- 写前用 eemeli yaml 解析 + 可选 `loadOverlayPatches`（app-boot）校验；写后失败自动回滚。
- **保留**其他行的 `!!js` 表达式与注释（eemeli Document API 往返保留）。

## 运行

### 安装

```powershell
# 本地开发（link: 热更新——改源码后 pnpm build 即可见）
dsh plugin --profile web add "link:<本仓库路径>"

# 远端（预构建 lib/ 入库，无 prepare，开箱即用）
dsh plugin --profile web add "github:dsh-external/dsh-mcp-manager"
```

安装后**重启 dsh web**（bundle 层在 boot 时加载），浏览器硬刷新（`Ctrl+Shift+R`）。

### 使用

- **GUI**：设置页 → 「MCP」面板。新增/编辑/删除服务器；点击「工具」展开该服务器的 `mcp__*` 工具列表。
- **Agent**：模型可调用 `mcp_server_list` / `mcp_server_add` / `mcp_server_update` / `mcp_server_remove`。

### API 路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/mcp-manager/servers` | GET | 列出服务器 + 工具数 + 状态 |
| `/api/mcp-manager/servers` | POST | 新增（body: `{config}`）→ HMR 挂载 |
| `/api/mcp-manager/servers/<id>` | PUT | 编辑（整块替换 config） |
| `/api/mcp-manager/servers/<id>` | DELETE | 删除 |
| `/api/mcp-manager/tools` | GET | 工具浏览（`mcp__` 前缀按 serverName 分组） |
| `/api/mcp-manager/status` | GET | 运行态状态 |

### Secret 处理

⚠ **P0：env / headers 以明文存入 profile `cordis.patch.yml`**（与官方示例同形态）。
README 明确警示：勿放长期密钥；部署隔离。P1 可接 `@deepseek-ai/dsh-credentials`（待设计）。

## 检查（合规自检，对照 plugin-development-guide.md §10）

- [x] **零源码 patch**：未修改 DSH checkout 任何文件
- [x] **B1**：`package.json` 声明 `dsh.bundle.patch`
- [x] **B2**：自带 `cordis.patch.yml`（insert 行 id/name 齐全）
- [x] **B3**：patch 行 `name` 用包名 `@huanlin/dsh-plugin-mcp-manager`
- [x] **F1**：`files` 含 `lib/` + `cordis.patch.yml`
- [x] **F2**：`peerDependencies` 含 cordis + `@deepseek-ai/*`（dsh-tools / dsh-app-boot / dsh-client-runtime / dsh-client-ui-primitives）
- [x] **F3**：typecheck / test / build 三 script 齐全（预构建策略：无 prepare，lib/ 入库）
- [x] **A4**：Config 校验用 `validateServerConfig`（fail loud，携带字段名）
- [x] **A6**：不导出 default
- [x] **C4**：工具返回规范 JSON 值 + render 投影分离
- [x] **G**：测试分层（Unit：27 用例覆盖增删改/唯一/非法拒绝/!!js 保留/空文件/多行）
- [x] **README**：含开发/运行/检查三节

### 预构建策略说明

含 `@deepseek-ai/*` private peer deps → 采用**预构建 `lib/` 入库**策略：
`lib/` 不进 `.gitignore`，无 `prepare` 脚本。`github:` 安装开箱即用（pnpm 在 git install 的
prepare 阶段拉不到 private 包，故不能用 prepare 策略）。
