/**
 * The plugin's own copy dictionaries for the "MCP" settings panel.
 *
 * The strings cover the whole user-visible surface: section heading and
 * intro, the add/edit form (field labels, example placeholders, save/cancel),
 * the server row actions (edit / enable|disable / delete / expand), and the
 * status pills ("tools" count, connecting, disconnected, disabled). `en` /
 * `zh` are registered with DSH's locale service and follow DSH's native
 * zh/en; the 19-language override dicts in
 * [dictionaries.ts](./dictionaries.ts) are handed to better-locale (when
 * installed) so a selected override language replaces them.
 *
 * The component default (`makeT(zh)`) is only a direct-mount fallback so the
 * panel stays usable outside the slot system (tests, quick mounts); inside
 * DSH the slot renderer always binds the locale-provided `t`.
 */

/** All copy keys for the dsh-plugin-mcp-manager namespace. */
export type McpManagerKey =
  | 'heading'
  | 'introBefore'
  | 'introMid'
  | 'introAfter'
  | 'envWarning'
  | 'loading'
  | 'empty'
  | 'addServer'
  | 'addTitle'
  | 'transport'
  | 'serverNameLabel'
  | 'serverNamePlaceholder'
  | 'commandLabel'
  | 'commandPlaceholder'
  | 'argsLabel'
  | 'argsPlaceholder'
  | 'envLabel'
  | 'envPlaceholder'
  | 'cwdLabel'
  | 'urlLabel'
  | 'urlPlaceholder'
  | 'headersLabel'
  | 'headersPlaceholder'
  | 'timeoutLabel'
  | 'cancel'
  | 'save'
  | 'add'
  | 'edit'
  | 'enable'
  | 'disable'
  | 'delete'
  | 'tools'
  | 'collapse'
  | 'noTools'
  | 'statusDisabled'
  | 'statusConnecting'
  | 'statusDisconnected'
  | 'toolCount'

/** Locale namespace id (matches the package basename; DSH locale namespace convention). */
export const NS = 'dsh-plugin-mcp-manager'

/** English dictionary. */
export const en: Record<McpManagerKey, string> = {
  heading: 'MCP Servers',
  introBefore: 'Manage MCP server connections. Each server is mounted by the official',
  introMid: 'and tools are registered under',
  introAfter: 'Config writes to the profile patch and applies live via HMR.',
  envWarning: '⚠ env / headers are stored as plaintext in the profile cordis.patch.yml (same shape as the official examples). Do not put long-lived secrets here. Disabling a server keeps its config; the loader skips mounting and tools stay unregistered (invisible to the model).',
  loading: 'Loading…',
  empty: 'No MCP servers yet. Click "Add server" to create one.',
  addServer: '+ Add server',
  addTitle: 'Add server',
  transport: 'Transport',
  serverNameLabel: 'serverName (tool namespace, must be unique)',
  serverNamePlaceholder: 'github',
  commandLabel: 'command',
  commandPlaceholder: 'npx',
  argsLabel: 'args (one per line)',
  argsPlaceholder: '-y\n@modelcontextprotocol/server-github',
  envLabel: 'env (one key=value per line, stored as plaintext)',
  envPlaceholder: 'GITHUB_TOKEN=ghp_xxx',
  cwdLabel: 'cwd (optional)',
  urlLabel: 'url',
  urlPlaceholder: 'https://mcp.example.com/mcp',
  headersLabel: 'headers (one key=value per line, stored as plaintext)',
  headersPlaceholder: 'Authorization=Bearer xxx',
  timeoutLabel: 'toolCallTimeoutMs',
  cancel: 'Cancel',
  save: 'Save',
  add: 'Add',
  edit: 'Edit',
  enable: 'Enable',
  disable: 'Disable',
  delete: 'Delete',
  tools: 'Tools',
  collapse: 'Collapse',
  noTools: '(no registered tools — server not connected or not synced)',
  statusDisabled: 'Disabled',
  statusConnecting: 'Connecting…',
  statusDisconnected: 'Not connected',
  toolCount: '{count} tools',
}

/** Chinese dictionary. */
export const zh: Record<McpManagerKey, string> = {
  heading: 'MCP 服务器',
  introBefore: '管理 MCP 服务器连接。每台服务器由官方',
  introMid: '挂载，工具以',
  introAfter: '命名注册。配置写入 profile patch，HMR 实时生效。',
  envWarning: '⚠ env / headers 以明文存入 profile cordis.patch.yml（与官方示例同形态）。勿放长期密钥。禁用服务器不会删除配置，loader 跳过挂载，工具不注册（模型不可见）。',
  loading: '加载中…',
  empty: '尚无 MCP 服务器。点击「新增」添加。',
  addServer: '+ 新增服务器',
  addTitle: '新增服务器',
  transport: '传输方式',
  serverNameLabel: 'serverName（工具命名空间，唯一）',
  serverNamePlaceholder: 'github',
  commandLabel: 'command',
  commandPlaceholder: 'npx',
  argsLabel: 'args（每行一个）',
  argsPlaceholder: '-y\n@modelcontextprotocol/server-github',
  envLabel: 'env（每行 key=value，明文存储）',
  envPlaceholder: 'GITHUB_TOKEN=ghp_xxx',
  cwdLabel: 'cwd（可空）',
  urlLabel: 'url',
  urlPlaceholder: 'https://mcp.example.com/mcp',
  headersLabel: 'headers（每行 key=value，明文存储）',
  headersPlaceholder: 'Authorization=Bearer xxx',
  timeoutLabel: 'toolCallTimeoutMs',
  cancel: '取消',
  save: '保存',
  add: '添加',
  edit: '编辑',
  enable: '启用',
  disable: '禁用',
  delete: '删除',
  tools: '工具',
  collapse: '收起',
  noTools: '（无已注册工具——服务器未连接或未同步）',
  statusDisabled: '已禁用',
  statusConnecting: '连接中…',
  statusDisconnected: '未连接',
  toolCount: '{count} 工具',
}

/** The translate function shape the panel consumes (structural; follows DSH's Translate). */
export type McpManagerTranslate = (key: McpManagerKey, params?: Record<string, unknown>) => string

/**
 * Build a translate function over one bundled dictionary. Interpolates
 * `{name}` params so a missing param leaves the placeholder in place.
 * @param dict - the dictionary to read from.
 * @returns a keyed translate function.
 */
export function makeT(dict: Record<McpManagerKey, string>): McpManagerTranslate {
  return (key, params) => {
    const template = dict[key]
    if (params === undefined) return template
    return template.replace(/\{(\w+)\}/g, (match: string, name: string) =>
      params[name] === undefined ? match : String(params[name]))
  }
}