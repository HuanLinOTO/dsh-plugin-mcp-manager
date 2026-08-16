/**
 * MCP 服务器注册表：读写 profile `cordis.patch.yml` 中
 * `name: '@deepseek-ai/dsh-mcp-client'` 的 insert 行。
 *
 * 单一事实来源与官方配置形态一致——每行 = 一个 mcp-client 插件实例，
 * 配置 HMR 实时挂载/卸载/热替换，连接生命周期完全委托官方 mcp-client。
 *
 * 实现要点（对照开发计划 §3）：
 * - 用 eemeli `yaml` 的 Document API（parseDocument → 改节点 → toString）
 *   而非行级字符串拼接：config 嵌套深，且需保留 `!!js` 表达式与其他行的
 *   注释/结构（已实证 eemeli yaml 往返保留 !!js + 注释，js-yaml 默认 schema
 *   拒绝 !!js）。
 * - 写前用官方 `loadOverlayPatches`（@deepseek-ai/dsh-app-boot）校验可解析，
 *   失败则拒绝写入（防写坏用户配置导致 web 启动失败）。
 * - serverName 全 profile 唯一（mcp-client 在加载时拒绝重复 serverName）。
 * - 编辑既有行：整块替换 config（不深合并），与 loader patch 语义一致。
 * - 删除行：移除 insert 块中该 `- id:` 子树；块空则删块。
 *
 * 零源码 patch：只读写 profile 的用户 patch 层（官方 HMR-watched 文件）。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { parseDocument, YAMLMap, YAMLSeq, type Document } from 'yaml'

/** mcp-client insert 行的 name 字段（官方包名，Loader 从 node_modules 解析）。 */
export const MCP_CLIENT_PACKAGE = '@deepseek-ai/dsh-mcp-client'

/** serverName 合法字符（与官方 mcp-client SERVER_NAME_PATTERN 一致）。 */
export const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

/** 官方 app-boot 的 patch 校验器（可选 peer：未装时降级为仅可解析检查）。 */
type LoadOverlayPatches = (binName: string, file: string) => unknown[]

/* ---------------- 路径解析（对齐 plugin-console） ---------------- */

/** 解析 DSH_HOME（官方 dsh-paths 语义）。 */
export function resolveDshHome(): string {
  return process.env.DSH_HOME?.trim() !== '' && process.env.DSH_HOME !== undefined
    ? process.env.DSH_HOME
    : join(process.env.HOME ?? process.env.USERPROFILE ?? '/tmp', '.dsh')
}

/** 当前 profile（web 默认）目录。 */
export function profileWebDir(): string {
  return join(resolveDshHome(), 'profiles', 'web')
}

/** 当前 profile 的 cordis.patch.yml（用户 patch 层，配置 HMR watched）。 */
export function profilePatchPath(): string {
  return join(profileWebDir(), 'cordis.patch.yml')
}

/* ---------------- 数据模型 ---------------- */

/** 一个 MCP 服务器配置（mcp-client insert 行的 config）。纯数据——
 *  不支持 `!!js` 表达式字段（README 说明；写回时强制为字面量值）。 */
export interface McpServerConfig {
  /** 工具命名空间 mcp__<serverName>__*。匹配 [A-Za-z0-9_-]{1,32}，全 profile 唯一。 */
  serverName: string
  /** 传输：stdio（子进程）或 streamable-http（SSE）。 */
  transport: 'stdio' | 'streamable-http'
  // --- stdio 字段 ---
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  // --- streamable-http 字段 ---
  url?: string
  headers?: Record<string, string>
  // --- 通用字段 ---
  toolCallTimeoutMs?: number
  failOnStartupError?: boolean
  reconnect?: {
    enabled?: boolean
    initialDelayMs?: number
    maxDelayMs?: number
    maxAttempts?: number
  }
}

/** 注册表中的一行（insert 行的投影）。 */
export interface McpServerRow {
  /** insert 行 id（用户可读、唯一，通常 mcp-<serverName>）。 */
  id: string
  /** insert 行 name（固定为 mcp-client 包名）。 */
  name: string
  /** 服务器配置。 */
  config: McpServerConfig
}

/** 校验错误（携带字段名便于 UI 定位）。 */
export class RegistryError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message)
    this.name = 'RegistryError'
  }
}

/* ---------------- 校验 ---------------- */

/**
 * 校验一个服务器配置。fail loud：非法值抛 RegistryError（携带字段名）。
 * 与官方 mcp-client Config schema 语义对齐，但不依赖其运行时（外部插件
 * 不能 import mcp-client src；契约以 README 为准）。
 */
export function validateServerConfig(config: unknown): asserts config is McpServerConfig {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new RegistryError('config', 'server config must be an object')
  }
  const c = config as Record<string, unknown>
  if (typeof c.serverName !== 'string' || !SERVER_NAME_PATTERN.test(c.serverName)) {
    throw new RegistryError('serverName', `serverName must match ${SERVER_NAME_PATTERN.source}`)
  }
  if (c.transport !== 'stdio' && c.transport !== 'streamable-http') {
    throw new RegistryError('transport', "transport must be 'stdio' or 'streamable-http'")
  }
  if (c.transport === 'stdio') {
    if (typeof c.command !== 'string' || c.command.length === 0) {
      throw new RegistryError('command', 'stdio transport requires a non-empty command')
    }
    if (c.args !== undefined && (!Array.isArray(c.args) || c.args.some(a => typeof a !== 'string'))) {
      throw new RegistryError('args', 'args must be an array of strings')
    }
    if (c.env !== undefined && (typeof c.env !== 'object' || c.env === null || Object.values(c.env).some(v => typeof v !== 'string'))) {
      throw new RegistryError('env', 'env must be a string→string map')
    }
    if (c.cwd !== undefined && typeof c.cwd !== 'string') {
      throw new RegistryError('cwd', 'cwd must be a string')
    }
  } else {
    // streamable-http
    if (typeof c.url !== 'string' || c.url.length === 0) {
      throw new RegistryError('url', 'streamable-http transport requires a non-empty url')
    }
    if (c.headers !== undefined && (typeof c.headers !== 'object' || c.headers === null || Object.values(c.headers).some(v => typeof v !== 'string'))) {
      throw new RegistryError('headers', 'headers must be a string→string map')
    }
  }
  if (c.toolCallTimeoutMs !== undefined && (typeof c.toolCallTimeoutMs !== 'number' || c.toolCallTimeoutMs < 1)) {
    throw new RegistryError('toolCallTimeoutMs', 'toolCallTimeoutMs must be a positive number')
  }
  if (c.failOnStartupError !== undefined && typeof c.failOnStartupError !== 'boolean') {
    throw new RegistryError('failOnStartupError', 'failOnStartupError must be a boolean')
  }
  if (c.reconnect !== undefined) {
    if (typeof c.reconnect !== 'object' || c.reconnect === null) {
      throw new RegistryError('reconnect', 'reconnect must be an object')
    }
    const r = c.reconnect as Record<string, unknown>
    if (r.enabled !== undefined && typeof r.enabled !== 'boolean') {
      throw new RegistryError('reconnect.enabled', 'reconnect.enabled must be a boolean')
    }
    for (const key of ['initialDelayMs', 'maxDelayMs', 'maxAttempts'] as const) {
      if (r[key] !== undefined && (typeof r[key] !== 'number' || r[key] < 1)) {
        throw new RegistryError(`reconnect.${key}`, `reconnect.${key} must be a positive number`)
      }
    }
  }
}

/** 生成 insert 行 id：mcp-<serverName>（serverName 已校验合法）。 */
export function rowIdFor(serverName: string): string {
  return `mcp-${serverName}`
}

/* ---------------- YAML Document 操作 ---------------- */

/** 一个新的空列表文档（每次调用返回新实例，避免共享可变状态）。 */
function emptyPatchDocument(): Document.Parsed {
  return parseDocument('[]\n')
}

/** 读取 patch 文件的 Document（保留注释/!!js）；文件不存在返回空文档。 */
function readPatchDocument(): Document.Parsed {
  const file = profilePatchPath()
  let content: string
  try {
    content = readFileSync(file, 'utf8')
  } catch {
    // 文件不存在：返回一个空列表文档（调用方按需 append）。
    return emptyPatchDocument()
  }
  const doc = parseDocument(content)
  // 顶层必须是数组（patch 列表）。非数组（如纯注释文件解析为 null）→ 空列表。
  if (!(doc.contents instanceof YAMLSeq)) {
    return emptyPatchDocument()
  }
  return doc
}

/** 在一个 insert 块（YAMLSeq）中找 mcp-client 行的索引；不存在返回 -1。 */
function findMcpRowIndex(block: YAMLSeq, id: string): number {
  for (let i = 0; i < block.items.length; i += 1) {
    const row = block.items[i]
    if (!(row instanceof YAMLMap)) continue
    if (row.get('id') === id) return i
  }
  return -1
}

/** 收集所有 insert 块中的 mcp-client 行（跨多个 insert 块，容错）。 */
function collectMcpRows(doc: Document.Parsed): Array<{ block: YAMLSeq; index: number; row: YAMLMap; id: string }> {
  const out: Array<{ block: YAMLSeq; index: number; row: YAMLMap; id: string }> = []
  const seq = doc.contents as YAMLSeq
  for (const entry of seq.items) {
    if (!(entry instanceof YAMLMap)) continue
    const insertNode = entry.get('insert', true)
    if (!(insertNode instanceof YAMLSeq)) continue
    const block = insertNode
    for (let i = 0; i < block.items.length; i += 1) {
      const row = block.items[i]
      if (!(row instanceof YAMLMap)) continue
      // get(key) 不传 true → 返回 JS 原生值（字符串直接是 string）；
      // name/id 是纯字符串字段（不含 !!js），安全直接取值。
      const name = row.get('name')
      if (name !== MCP_CLIENT_PACKAGE) continue
      const id = typeof row.get('id') === 'string' ? row.get('id') as string : ''
      out.push({ block, index: i, row, id })
    }
  }
  return out
}

/** 将 McpServerConfig 转为纯 YAML 数据（用于 set 创建节点）。 */
function configToData(config: McpServerConfig): Record<string, unknown> {
  const data: Record<string, unknown> = { ...config }
  return data
}

/* ---------------- 公开 API ---------------- */

/**
 * 读全部 MCP 服务器行。配置块缺失/结构异常的行被跳过（不抛——读路径容忍）。
 * 返回每行的 id 与解析出的 config（仅含存在的字段）。
 */
export function listServers(): McpServerRow[] {
  const doc = readPatchDocument()
  const rows = collectMcpRows(doc)
  const out: McpServerRow[] = []
  for (const { row, id } of rows) {
    const cfgNode = row.get('config', true)
    if (!(cfgNode instanceof YAMLMap)) continue
    // toJS(doc) 把节点转纯值（!!js 表达式在此会抛——读路径捕获并跳过该行）。
    let config: McpServerConfig
    try {
      config = cfgNode.toJS(doc) as McpServerConfig
    } catch {
      continue
    }
    out.push({ id, name: MCP_CLIENT_PACKAGE, config })
  }
  return out
}

/**
 * 读单个服务器行（按 id）。不存在返回 undefined。
 */
export function getServer(id: string): McpServerRow | undefined {
  return listServers().find(r => r.id === id)
}

/** 写回 patch 文件并校验：可选 app-boot 校验器在场则用之，否则仅保证可解析。 */
function writeAndValidate(doc: Document.Parsed, loadOverlayPatches?: LoadOverlayPatches): void {
  const file = profilePatchPath()
  const text = doc.toString()
  // 读旧内容用于失败回滚（文件不存在则为 null）。
  let previous: string | null = null
  try {
    previous = readFileSync(file, 'utf8')
  } catch {
    previous = null
  }
  // 写新内容。
  writeFileSync(file, text)
  // 写后校验：用官方 loadOverlayPatches（若装了 app-boot）确认可解析+结构合法。
  // 失败则回滚到旧内容（防写坏导致 web 启动失败）。
  if (loadOverlayPatches !== undefined) {
    try {
      loadOverlayPatches('dsh-mcp-manager', file)
    } catch (error) {
      // 回滚。
      if (previous !== null) writeFileSync(file, previous)
      throw new RegistryError('patch', `写入后校验失败（已回滚）: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

/**
 * 尝试动态解析官方 app-boot 的 loadOverlayPatches（可选 peer）。
 * 未安装/不可导入时返回 undefined（降级为仅可解析检查——eemeli yaml 序列化
 * 保证输出是合法 YAML 数组，写坏风险已极低）。
 */
export function resolveLoadOverlayPatches(): LoadOverlayPatches | undefined {
  try {
    // createRequire 在 ESM 中同步加载 CJS/ESM 包（app-boot 是 boot 时已加载的
    // 官方包，profile 闭包内可解析）。失败=未装，降级为仅可解析检查。
    const require = createRequire(import.meta.url)
    const mod = require('@deepseek-ai/dsh-app-boot') as { loadOverlayPatches?: LoadOverlayPatches }
    return typeof mod.loadOverlayPatches === 'function' ? mod.loadOverlayPatches : undefined
  } catch {
    return undefined
  }
}

/**
 * 新增一个 MCP 服务器。校验配置 + serverName 唯一 → 写 insert 行。
 * @param config 服务器配置（纯数据）。
 * @param id 可选行 id；默认 mcp-<serverName>。
 * @param loadOverlayPatches 可选官方校验器（app-boot 提供）。
 * @returns 新增行的 id。
 * @throws RegistryError 配置非法 / serverName 重复 / id 重复 / 写后校验失败。
 */
export function addServer(
  config: McpServerConfig,
  opts?: { id?: string; loadOverlayPatches?: LoadOverlayPatches; previousText?: string },
): string {
  validateServerConfig(config)
  const id = (opts?.id ?? rowIdFor(config.serverName)).trim()
  if (id.length === 0) throw new RegistryError('id', 'id must be non-empty')

  const doc = readPatchDocument()
  const existing = collectMcpRows(doc)
  // serverName 唯一（跨所有 mcp-client 行）。
  if (existing.some(r => {
    const cfg = r.row.get('config', true)
    if (!(cfg instanceof YAMLMap)) return false
    return cfg.get('serverName') === config.serverName
  })) {
    throw new RegistryError('serverName', `serverName "${config.serverName}" is already in use`)
  }
  // id 唯一。
  if (existing.some(r => r.id === id)) {
    throw new RegistryError('id', `id "${id}" is already in use`)
  }

  // 找一个已有的 insert 块追加，否则新建 insert 块。
  const seq = doc.contents as YAMLSeq
  let targetBlock: YAMLSeq | undefined
  for (const entry of seq.items) {
    if (!(entry instanceof YAMLMap)) continue
    const insertNode = entry.get('insert', true)
    if (insertNode instanceof YAMLSeq) { targetBlock = insertNode; break }
  }
  if (targetBlock === undefined) {
    const insertEntry = new YAMLMap()
    const newBlock = new YAMLSeq()
    insertEntry.set('insert', newBlock)
    seq.add(insertEntry)
    targetBlock = newBlock
  }

  const row = new YAMLMap()
  row.set('id', id)
  row.set('name', MCP_CLIENT_PACKAGE)
  row.set('config', doc.createNode(configToData(config)))
  targetBlock.add(row)

  writeAndValidate(doc, opts?.loadOverlayPatches)
  console.log(`[dsh-mcp-manager] added server ${id} (serverName=${config.serverName})`)
  return id
}

/**
 * 更新一个服务器（整块替换 config）。serverName 可改（需保持唯一）。
 * @throws RegistryError 配置非法 / id 不存在 / serverName 与他人冲突 / 写后校验失败。
 */
export function updateServer(
  id: string,
  config: McpServerConfig,
  opts?: { loadOverlayPatches?: LoadOverlayPatches },
): void {
  validateServerConfig(config)
  const doc = readPatchDocument()
  const rows = collectMcpRows(doc)
  const target = rows.find(r => r.id === id)
  if (target === undefined) {
    throw new RegistryError('id', `server "${id}" not found`)
  }
  // serverName 唯一（排除自身）。
  for (const r of rows) {
    if (r.id === id) continue
    const cfg = r.row.get('config', true)
    if (!(cfg instanceof YAMLMap)) continue
    if (cfg.get('serverName') === config.serverName) {
      throw new RegistryError('serverName', `serverName "${config.serverName}" is already in use by "${r.id}"`)
    }
  }
  // 整块替换 config（不深合并，与 loader patch 语义一致）。
  target.row.set('config', doc.createNode(configToData(config)))
  writeAndValidate(doc, opts?.loadOverlayPatches)
  console.log(`[dsh-mcp-manager] updated server ${id}`)
}

/**
 * 删除一个服务器行。空掉的 insert 块一并删除（空 insert 是脏 patch）。
 * @returns true 删除成功；false 行不存在。
 */
export function deleteServer(
  id: string,
  opts?: { loadOverlayPatches?: LoadOverlayPatches },
): boolean {
  const doc = readPatchDocument()
  const rows = collectMcpRows(doc)
  const target = rows.find(r => r.id === id)
  if (target === undefined) return false
  // 从其 insert 块中移除该行。
  target.block.delete(target.index)
  // 若该 insert 块空了，移除整个 insert 条目（空 insert 是脏 patch）。
  if (target.block.items.length === 0) {
    const seq = doc.contents as YAMLSeq
    for (let i = 0; i < seq.items.length; i += 1) {
      const entry = seq.items[i]
      if (!(entry instanceof YAMLMap)) continue
      const insertNode = entry.get('insert', true)
      if (insertNode instanceof YAMLSeq && insertNode === target.block) {
        seq.delete(i)
        break
      }
    }
  }
  writeAndValidate(doc, opts?.loadOverlayPatches)
  console.log(`[dsh-mcp-manager] deleted server ${id}`)
  return true
}

/** patch 文件是否可读（存在且可解析为 patch 列表）。 */
export function isPatchReadable(): boolean {
  try {
    const doc = readPatchDocument()
    void doc
    return true
  } catch {
    return false
  }
}

/** 备份 patch 文件到 .bak（写前调用，防写坏）。返回备份路径或 null。 */
export function backupPatch(): string | null {
  const file = profilePatchPath()
  if (!existsSync(file)) return null
  const bak = `${file}.bak`
  try {
    writeFileSync(bak, readFileSync(file, 'utf8'))
    return bak
  } catch {
    return null
  }
}
