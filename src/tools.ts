/**
 * MCP 管理工具（mcp_* ×5）：agent 面的服务器注册表管理（对齐开发计划 §M4）。
 * 与 GUI 面板写同一安装态（profile cordis.patch.yml 的 mcp-client insert 行），
 * 配置 HMR 实时挂载——agent 调用后工具立即可用（若服务器连接成功）。
 *
 * - mcp_server_list：列出全部 MCP 服务器 + 每个的已注册工具数（运行态）
 * - mcp_server_add：新增服务器（校验 + 写 insert 行 → HMR 挂载 mcp-client 实例）
 * - mcp_server_update：整块替换 config（serverName 不变则工具名不变）
 * - mcp_server_remove：移除行 → 工具随实例 dispose 注销
 * - mcp_server_set_enabled：禁用/启用 entry-level disabled 字段（config 保留，
 *   禁用时 loader 跳过挂载 → 工具不注册 → 模型不可见）
 *
 * 依赖注入（deps）：避免与 index.ts 循环依赖。连接生命周期完全委托官方
 * mcp-client——管理插件只写配置，不拉连接。
 */
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { McpServerConfig, McpServerRow } from './registry.ts'

/** tools 依赖（由 index.ts apply 注入）。 */
export interface McpToolDeps {
  /** 列出全部服务器行（注册表读）。 */
  listServers(): McpServerRow[]
  /** 新增服务器（校验 + 写 insert 行）。返回行 id。 */
  addServer(config: McpServerConfig, opts?: { id?: string }): string
  /** 整块替换 config。 */
  updateServer(id: string, config: McpServerConfig): void
  /** 删除行。返回是否删除。 */
  deleteServer(id: string): boolean
  /** 设置禁用状态（entry-level disabled 字段；config 保留）。 */
  setServerDisabled(id: string, disabled: boolean): void
  /** 运行态：已注册工具 schemas（ctx.tools.schemas()），用于按 serverName 计数。 */
  registeredToolNames(): string[]
  /** 各 serverName 最近配置写入时间戳（推断「连接中」中间状态）。 */
  connectingSince: Map<string, number>
  /** 自身包名（自毁防护：不可删除管理插件自身的 insert 行——虽然它不是 mcp 行）。 */
  selfId: string
}

/** 一个服务器的运行态投影（agent 可见的规范 JSON）。 */
interface ServerView {
  id: string
  serverName: string
  transport: string
  /** 端点摘要：stdio → command；http → url。 */
  endpoint: string
  /** 已注册工具数（mcp__<serverName>__ 前缀的 schema 数；禁用时强制为 0）。 */
  toolCount: number
  /**
   * 是否被禁用（entry-level `disabled: true`）。禁用时配置保留在 patch 文件中，
   * 但 loader 跳过挂载 mcp-client 实例 → 工具不注册（模型不可见）。
   */
  disabled: boolean
  /**
   * 状态：disabled（entry-level disabled=true，loader 未挂载实例，工具未注册）/
   * connected（工具数>0）/ connecting（0 工具但在配置写入宽限窗内，mcp-client
   * 正在挂载/握手）/ disconnected（0 工具且超窗，连接失败/重连中）。
   */
  status: 'connected' | 'connecting' | 'disconnected' | 'disabled'
}

/** 把注册表行 + 运行态工具名投影为 agent 可见的规范视图。 */
function toServerView(row: McpServerRow, toolNames: string[], connectingSince: Map<string, number>): ServerView {
  const prefix = `mcp__${row.config.serverName}__`
  const toolCount = row.disabled ? 0 : toolNames.filter(n => n.startsWith(prefix)).length
  const endpoint = row.config.transport === 'stdio'
    ? `${row.config.command ?? ''} ${(row.config.args ?? []).join(' ')}`.trim()
    : (row.config.url ?? '')
  let status: ServerView['status']
  if (row.disabled) {
    status = 'disabled'
  } else if (toolCount > 0) {
    status = 'connected'
  } else {
    const since = connectingSince.get(row.config.serverName)
    status = since !== undefined && Date.now() - since < 30_000 ? 'connecting' : 'disconnected'
  }
  return {
    id: row.id,
    serverName: row.config.serverName,
    transport: row.config.transport,
    endpoint,
    toolCount,
    disabled: row.disabled,
    status,
  }
}

function renderServers(_args: Record<string, unknown>, value: { servers: ServerView[] }): import('@deepseek-ai/dsh-llm').ContentBlock[] {
  if (value.servers.length === 0) return [{ type: 'text', text: '(no MCP servers registered)' }]
  const lines = value.servers.map(s =>
    `- ${s.id} [${s.status}] ${s.transport} · ${s.serverName} · ${s.toolCount} tool(s) · ${s.endpoint}`,
  )
  return [{ type: 'text', text: lines.join('\n') }]
}

/** 共享参数 schema（add/update 用同一组字段描述）。 */
const SERVER_PARAMS = {
  serverName: { type: 'string', required: true, description: 'Stable namespace for tool names (mcp__<serverName>__*). Must match [A-Za-z0-9_-]{1,32} and be unique.' },
  transport: { type: 'string', required: true, description: "Transport: 'stdio' (spawned child process) or 'streamable-http' (SSE)." },
  command: { type: 'string', description: 'stdio: executable to start the server.' },
  args: { type: 'array', items: { type: 'string' }, description: 'stdio: arguments passed to the command.' },
  env: { type: 'object', additionalProperties: true, description: 'stdio: extra env vars (string→string). WARNING: stored in plaintext in the profile patch file.' },
  cwd: { type: 'string', description: 'stdio: working directory.' },
  url: { type: 'string', description: 'streamable-http: MCP endpoint URL.' },
  headers: { type: 'object', additionalProperties: true, description: 'streamable-http: additional headers (string→string). WARNING: stored in plaintext.' },
  toolCallTimeoutMs: { type: 'number', description: 'Per-tool-call timeout in ms (default 60000).' },
  failOnStartupError: { type: 'boolean', description: 'Fail plugin activation on initial connection error (default false).' },
} as const

/** 从 defineTool 的 args（JsonValue 宽类型）构造 McpServerConfig。 */
function configFromArgs(args: Record<string, unknown>): McpServerConfig {
  const config: McpServerConfig = {
    serverName: String(args.serverName ?? ''),
    transport: args.transport === 'streamable-http' ? 'streamable-http' : 'stdio',
  }
  if (typeof args.command === 'string') config.command = args.command
  if (Array.isArray(args.args)) config.args = args.args.map(String)
  if (args.env !== null && typeof args.env === 'object') config.env = Object.fromEntries(Object.entries(args.env as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
  if (typeof args.cwd === 'string') config.cwd = args.cwd
  if (typeof args.url === 'string') config.url = args.url
  if (args.headers !== null && typeof args.headers === 'object') config.headers = Object.fromEntries(Object.entries(args.headers as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
  if (typeof args.toolCallTimeoutMs === 'number') config.toolCallTimeoutMs = args.toolCallTimeoutMs
  if (typeof args.failOnStartupError === 'boolean') config.failOnStartupError = args.failOnStartupError
  return config
}

export function createMcpTools(deps: McpToolDeps): ToolDefinition[] {
  return [
    defineTool({
      name: 'mcp_server_list',
      description: 'List registered MCP servers and their live tool counts. Each server is an '
        + '@deepseek-ai/dsh-mcp-client instance mounted from the profile cordis.patch.yml insert row. '
        + 'status: connected (tools registered), connecting (mcp-client mounting/handshaking within '
        + 'the post-write grace window), disconnected (0 tools past the grace window — failed/exhausted), '
        + 'disabled (entry-level disabled=true — config preserved but loader skips mounting, tools not '
        + 'registered and invisible to the model).',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            servers: {
              type: 'array',
              required: true,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'string', required: true },
                  serverName: { type: 'string', required: true },
                  transport: { type: 'string', required: true },
                  endpoint: { type: 'string', required: true },
                  toolCount: { type: 'number', required: true },
                  disabled: { type: 'boolean', required: true },
                  status: { type: 'string', required: true, enum: ['connected', 'connecting', 'disconnected', 'disabled'] },
                },
              },
            },
          },
        },
        render: renderServers,
      },
      async execute() {
        const toolNames = deps.registeredToolNames()
        const servers = deps.listServers().map(r => toServerView(r, toolNames, deps.connectingSince))
        return { servers }
      },
    }),

    defineTool({
      name: 'mcp_server_add',
      description: 'Register a new MCP server. Writes an mcp-client insert row into the profile '
        + 'cordis.patch.yml; the config HMR mounts the @deepseek-ai/dsh-mcp-client instance live '
        + '(no restart). Connection lifecycle is delegated to the official mcp-client. '
        + 'env/headers are stored in PLAINTEXT — do not put long-lived secrets there without '
        + 'accepting the risk.',
      parameters: SERVER_PARAMS,
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            id: { type: 'string', required: true },
            message: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.message }],
      },
      async execute(args) {
        const config = configFromArgs(args as Record<string, unknown>)
        const id = deps.addServer(config)
        return {
          ok: true,
          id: String(id),
          message: `mcp_server_add: registered "${config.serverName}" (id ${id}) — config HMR is mounting the mcp-client instance; tools will appear as mcp__${config.serverName}__* once the connection succeeds.`,
        }
      },
    }),

    defineTool({
      name: 'mcp_server_update',
      description: 'Update an MCP server config (replaces the whole config block, no deep merge). '
        + 'If serverName is unchanged, the public tool names stay the same; the mcp-client '
        + 'instance hot-swaps (disconnect + reconnect). serverName changes require uniqueness.',
      parameters: {
        id: { type: 'string', required: true, description: 'The server insert-row id (e.g. mcp-github).' },
        ...SERVER_PARAMS,
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            id: { type: 'string', required: true },
            message: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.message }],
      },
      async execute(args) {
        const id = String(args.id)
        const config = configFromArgs(args as Record<string, unknown>)
        deps.updateServer(id, config)
        return {
          ok: true,
          id,
          message: `mcp_server_update: replaced config for "${id}" (serverName=${config.serverName}) — mcp-client hot-swapping.`,
        }
      },
    }),

    defineTool({
      name: 'mcp_server_remove',
      description: 'Remove an MCP server. Deletes its insert row from the profile cordis.patch.yml; '
        + 'the mcp-client instance disposes and its tools (mcp__<serverName>__*) unregister via config HMR.',
      parameters: {
        id: { type: 'string', required: true, description: 'The server insert-row id to remove.' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            id: { type: 'string', required: true },
            message: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.message }],
      },
      async execute(args) {
        const id = String(args.id)
        const removed = deps.deleteServer(id)
        if (!removed) throw new Error(`mcp_server_remove: "${id}" is not a registered MCP server`)
        return {
          ok: true,
          id,
          message: `mcp_server_remove: removed "${id}" — mcp-client disposing, tools unregistering.`,
        }
      },
    }),

    defineTool({
      name: 'mcp_server_set_enabled',
      description: 'Enable or disable an MCP server without deleting its config. Sets the entry-level '
        + '`disabled` field (sibling of id/name/config) in the profile cordis.patch.yml. When disabled, '
        + 'the loader skips mounting the @deepseek-ai/dsh-mcp-client instance — its tools '
        + '(mcp__<serverName>__*) are NOT registered and the model CANNOT see or call them. The config '
        + 'block is preserved verbatim, so re-enabling is a no-cost toggle (no re-entry of fields). '
        + 'Use this instead of mcp_server_remove when you want to temporarily hide a server from the model.',
      parameters: {
        id: { type: 'string', required: true, description: 'The server insert-row id (e.g. mcp-github).' },
        enabled: { type: 'boolean', required: true, description: 'true = mount the instance (tools visible); false = skip mounting (tools hidden, config preserved).' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            id: { type: 'string', required: true },
            enabled: { type: 'boolean', required: true },
            message: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.message }],
      },
      async execute(args) {
        const id = String(args.id)
        const enabled = Boolean(args.enabled)
        deps.setServerDisabled(id, !enabled)
        return {
          ok: true,
          id,
          enabled,
          message: enabled
            ? `mcp_server_set_enabled: enabled "${id}" — mcp-client mounting via config HMR, tools will appear as mcp__<serverName>__* once the connection succeeds.`
            : `mcp_server_set_enabled: disabled "${id}" — mcp-client disposing, tools unregistering. Config preserved in patch file; re-enable anytime.`,
        }
      },
    }),
  ]
}
