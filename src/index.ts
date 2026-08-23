/**
 * dsh-mcp-manager Node half（0812 适配）：MCP 服务器注册表的「写配置层」
 * +「状态/工具浏览层」。连接生命周期完全委托官方 @deepseek-ai/dsh-mcp-client
 * ——管理插件只写 profile cordis.patch.yml 的 mcp-client insert 行（配置 HMR
 * 实时挂载/卸载/热替换），不自己拉连接。
 *
 * 0 patch：完全官方机制——glue 插件经 bundle 挂载，安装态是官方 HMR-watched
 * 的 profile 用户 patch 层。经 webServer 提供 `/api/mcp-manager` 路由供浏览器
 * 面板调用；经 ctx.tools 注册 mcp_* 管理工具供 agent 调用。
 *
 * 禁用语义（与删除分离）：entry-level `disabled: true` 字段（与 id/name/config
 * 同级）使 loader 跳过挂载 mcp-client 实例 → 工具不注册（模型不可见），config
 * 保留在 patch 文件中。PATCH /servers/<id> 路由 + mcp_server_set_enabled 工具
 * 写该字段；启用时移除该字段，loader HMR 重新挂载实例。
 *
 * 架构（对齐开发计划 §1）：
 *   GUI(settings.section) ──HTTP──> /api/mcp-manager ──读写──> profile cordis.patch.yml
 *   Agent 面 mcp_* 工具 ─────────────────────────────┘        (mcp-client insert 行)
 *                                                                │ 配置 HMR 实时挂载
 *                                                                ▼
 *                                                  官方 mcp-client 实例（连接+注册工具）
 *   GUI 状态/工具浏览 <──ctx.tools.schemas() 过滤 mcp__──┘
 */
import type { Context } from 'cordis'
import {
  listServers,
  addServer,
  updateServer,
  deleteServer,
  setServerDisabled,
  resolveLoadOverlayPatches,
  RegistryError,
  type McpServerConfig,
} from './registry.ts'
import { createMcpTools } from './tools.ts'

/** webServer 注册契约（对齐 plugin-console）。 */
interface WebServerLike {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: unknown, res: { statusCode: number; setHeader(k: string, v: string): void; end(body: string): void }) => void | Promise<void>
  }): () => void
}

/** Cordis 插件名。 */
export const name = 'dsh-mcp-manager'

/** 需要宿主 web server（web 组合）+ tools（注册 mcp_* 工具 + 读 schemas 浏览）。 */
export const inject = ['webServer', 'tools']

interface ManagerCtx extends Context {
  webServer?: WebServerLike
  tools?: {
    register(definition: unknown): () => void
    schemas(): Array<{ name: string; description: string; parameters: unknown }>
  }
}

/** 读请求体（POST/PUT）。 */
function readBody(req: unknown): Promise<string> {
  return new Promise(resolve => {
    let body = ''
    const r = req as { on?: (e: string, cb: (c: Buffer) => void) => void }
    r.on?.('data', (c: Buffer) => { body += c.toString('utf8') })
    r.on?.('end', () => resolve(body))
  })
}

/**
 * 「连接中」宽限窗（毫秒）。addServer/updateServer 写入 insert 行后，mcp-client
 * 经配置 HMR 挂载 → spawn 子进程/握手 → 同步工具，期间工具数=0。在该窗内
 * 0 工具判为「连接中」而非「未连接」，避免面板长时间卡在误导性的「未连接」。
 * 窗口过后仍 0 工具才判为「未连接/失败」（重连预算内或已耗尽）。
 *
 * 30s 覆盖典型首次连接 + 若干次指数退避（500ms→1s→2s→4s→8s→16s）。
 * mcp-client 的连接状态封装在 startConnection 闭包内，外部无直接信号——
 * 这是 P0 朴素推断（对齐开发计划 §4），非真实连接状态。
 */
const CONNECTING_GRACE_MS = 30_000

/** 计算一个服务器的四态状态。 */
function computeStatus(
  toolCount: number,
  serverName: string,
  connectingSince: Map<string, number>,
  disabled: boolean,
): 'connected' | 'connecting' | 'disconnected' | 'disabled' {
  if (disabled) return 'disabled'
  if (toolCount > 0) return 'connected'
  const since = connectingSince.get(serverName)
  if (since !== undefined && Date.now() - since < CONNECTING_GRACE_MS) return 'connecting'
  return 'disconnected'
}

/** 注册控制台路由 + agent 工具。 */
export function apply(ctx: ManagerCtx): void {
  ctx.effect(() => {
    // 官方 patch 校验器（可选 peer：app-boot 提供时启用写后校验+回滚）。
    const loadOverlayPatches = resolveLoadOverlayPatches()

    /**
     * 各 serverName 最近一次「写配置」的时间戳（add/update）。用于推断「连接中」
     * 中间状态——mcp-client 经 HMR 挂载到工具注册有延迟。进程内存：web 重启
     * 后丢失，此时退化为「未连接」直到工具真正出现（可接受，重启少见）。
     */
    const connectingSince = new Map<string, number>()

    /** 记录一次配置写入，标记该 serverName 进入「连接中」宽限窗。 */
    const markConnecting = (serverName: string): void => {
      connectingSince.set(serverName, Date.now())
    }

    /** 清除连接中标记（禁用时调用——不再处于连接中，而是已禁用）。 */
    const clearConnecting = (serverName: string): void => {
      connectingSince.delete(serverName)
    }

    // AI-native MCP 管理工具（mcp_*）：agent 面 = 面板写同一安装态。
    const mcpTools = createMcpTools({
      listServers,
      addServer: (config, opts) => {
        const id = addServer(config, { ...opts, loadOverlayPatches })
        markConnecting(config.serverName)
        return id
      },
      updateServer: (id, config) => {
        updateServer(id, config, { loadOverlayPatches })
        markConnecting(config.serverName)
      },
      deleteServer: id => deleteServer(id, { loadOverlayPatches }),
      setServerDisabled: (id, disabled) => {
        setServerDisabled(id, disabled, { loadOverlayPatches })
        // 找到该 id 对应的 serverName 以清理 connecting 标记（禁用→不再连接中）。
        if (disabled) {
          const row = listServers().find(r => r.id === id)
          if (row !== undefined) clearConnecting(row.config.serverName)
        } else {
          // 启用：进入「连接中」宽限窗（loader HMR 重新挂载 mcp-client）。
          const row = listServers().find(r => r.id === id)
          if (row !== undefined) markConnecting(row.config.serverName)
        }
      },
      registeredToolNames: () => (ctx.tools?.schemas() ?? []).map(s => s.name),
      connectingSince,
      selfId: '@huanlin/dsh-plugin-mcp-manager',
    })
    const disposeTools = (ctx.tools?.register !== undefined)
      ? mcpTools.map(tool => ctx.tools!.register(tool))
      : []
    if (disposeTools.length > 0) {
      console.log(`[dsh-mcp-manager] registered mcp tools: ${mcpTools.map(t => (t as { name?: string }).name).join(', ')}`)
    }

    const webServer = ctx.webServer
    if (webServer === undefined) {
      return () => { for (const dispose of disposeTools) dispose() }
    }

    const disposeRoutes = webServer.register({
      kind: 'prefix',
      path: '/api/mcp-manager',
      handler: async (req, res) => {
        const json = (status: number, body: unknown): void => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(body))
        }
        const url = (req as { url?: string })?.url ?? '/'
        const method = (req as { method?: string })?.method ?? 'GET'
        const path = url.split('?')[0] ?? '/'

        const jsonRes = (status: number, body: unknown): void => json(status, body)

        try {
          // GET /servers — 列出注册表 + 运行态工具数
          if (method === 'GET' && (path === '/api/mcp-manager/servers' || path === '/api/mcp-manager/servers/')) {
            const toolNames = (ctx.tools?.schemas() ?? []).map(s => s.name)
            const servers = listServers().map(row => {
              const prefix = `mcp__${row.config.serverName}__`
              const toolCount = row.disabled ? 0 : toolNames.filter(n => n.startsWith(prefix)).length
              return {
                id: row.id,
                serverName: row.config.serverName,
                transport: row.config.transport,
                endpoint: row.config.transport === 'stdio'
                  ? `${row.config.command ?? ''} ${(row.config.args ?? []).join(' ')}`.trim()
                  : (row.config.url ?? ''),
                toolCount,
                disabled: row.disabled,
                status: computeStatus(toolCount, row.config.serverName, connectingSince, row.disabled),
                config: row.config,
              }
            })
            jsonRes(200, { ok: true, servers })
            return
          }

          // GET /tools — 工具浏览：ctx.tools.schemas() 过滤 mcp__ 前缀，按 serverName 分组
          if (method === 'GET' && (path === '/api/mcp-manager/tools' || path === '/api/mcp-manager/tools/')) {
            const schemas = ctx.tools?.schemas() ?? []
            const mcpToolsList = schemas
              .filter(s => s.name.startsWith('mcp__'))
              .map(s => {
                const parts = s.name.split('__')
                const serverName = parts[1] ?? ''
                const rawName = parts.slice(2).join('__')
                return { name: s.name, serverName, rawName, description: s.description }
              })
            // 按 serverName 分组
            const groups: Record<string, Array<{ name: string; rawName: string; description: string }>> = {}
            for (const t of mcpToolsList) {
              const arr = groups[t.serverName] ?? []
              arr.push({ name: t.name, rawName: t.rawName, description: t.description })
              groups[t.serverName] = arr
            }
            jsonRes(200, { ok: true, groups })
            return
          }

          // GET /status — 每个服务器的运行态状态
          if (method === 'GET' && (path === '/api/mcp-manager/status' || path === '/api/mcp-manager/status/')) {
            const toolNames = (ctx.tools?.schemas() ?? []).map(s => s.name)
            const status = listServers().map(row => {
              const prefix = `mcp__${row.config.serverName}__`
              const toolCount = row.disabled ? 0 : toolNames.filter(n => n.startsWith(prefix)).length
              return {
                id: row.id,
                serverName: row.config.serverName,
                toolCount,
                disabled: row.disabled,
                status: computeStatus(toolCount, row.config.serverName, connectingSince, row.disabled),
              }
            })
            jsonRes(200, { ok: true, status })
            return
          }

          // POST /servers — 新增服务器
          if (method === 'POST' && (path === '/api/mcp-manager/servers' || path === '/api/mcp-manager/servers/')) {
            const body = await readBody(req)
            const parsed = JSON.parse(body) as { config?: McpServerConfig; id?: string }
            if (parsed.config === undefined) {
              jsonRes(400, { ok: false, message: 'config is required' })
              return
            }
            const id = addServer(parsed.config, { id: parsed.id, loadOverlayPatches })
            markConnecting(parsed.config.serverName)
            jsonRes(200, { ok: true, id, live: true, message: `server ${id} mounted via config HMR` })
            return
          }

          // PUT /servers/<id> — 编辑（整块替换 config）
          const putMatch = /^\/api\/mcp-manager\/servers\/([^/]+)$/.exec(path)
          if (method === 'PUT' && putMatch !== null) {
            const id = decodeURIComponent(putMatch[1]!)
            const body = await readBody(req)
            const parsed = JSON.parse(body) as { config?: McpServerConfig }
            if (parsed.config === undefined) {
              jsonRes(400, { ok: false, message: 'config is required' })
              return
            }
            updateServer(id, parsed.config, { loadOverlayPatches })
            markConnecting(parsed.config.serverName)
            jsonRes(200, { ok: true, id, live: true, message: `server ${id} config replaced (HMR hot-swap)` })
            return
          }

          // PATCH /servers/<id> — 部分更新（目前仅支持 disabled 字段）
          if (method === 'PATCH' && putMatch !== null) {
            const id = decodeURIComponent(putMatch[1]!)
            const body = await readBody(req)
            const parsed = JSON.parse(body) as { disabled?: boolean }
            if (parsed.disabled === undefined || typeof parsed.disabled !== 'boolean') {
              jsonRes(400, { ok: false, message: 'disabled (boolean) is required' })
              return
            }
            const ok = setServerDisabled(id, parsed.disabled, { loadOverlayPatches })
            if (!ok) {
              jsonRes(404, { ok: false, message: `server "${id}" not found` })
              return
            }
            // 禁用→清除 connecting 标记；启用→进入连接中宽限窗。
            const row = listServers().find(r => r.id === id)
            if (row !== undefined) {
              if (parsed.disabled) connectingSince.delete(row.config.serverName)
              else markConnecting(row.config.serverName)
            }
            jsonRes(200, { ok: true, id, disabled: parsed.disabled, message: `server ${id} ${parsed.disabled ? 'disabled' : 'enabled'} (config preserved)` })
            return
          }

          // DELETE /servers/<id> — 删除
          if (method === 'DELETE' && putMatch !== null) {
            const id = decodeURIComponent(putMatch[1]!)
            const removed = deleteServer(id, { loadOverlayPatches })
            if (!removed) {
              jsonRes(404, { ok: false, message: `server "${id}" not found` })
              return
            }
            jsonRes(200, { ok: true, id, message: `server ${id} removed (tools unregistering)` })
            return
          }

          jsonRes(404, { ok: false, message: 'not found' })
        } catch (error) {
          // RegistryError → 400（客户端可修正）；其他 → 500。
          if (error instanceof RegistryError) {
            jsonRes(400, { ok: false, field: error.field, message: error.message })
          } else {
            jsonRes(500, { ok: false, message: error instanceof Error ? error.message : String(error) })
          }
        }
      },
    })

    return () => {
      for (const dispose of disposeTools) dispose()
      disposeRoutes()
    }
  }, 'dsh-mcp-manager: config read/write route + mcp tools')
}
