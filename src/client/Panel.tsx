/**
 * MCP 管理面板（UI 对齐官方「模型」设置页设计语言）：
 * - 服务器列表：serverName + 传输标识 + 端点摘要 + 状态 Pill（connected/
 *   disconnected）+ 工具数；行内操作：编辑 / 删除
 * - 新增/编辑表单：transport 切换（stdio ↔ streamable-http 字段组联动）；
 *   serverName/command/args/env/url/headers/超时
 * - 工具浏览：点击服务器展开其 mcp__ 工具列表（名称 + 描述），只读
 * 全部 token 走 --dsw-alias-*；零 CSS 依赖（inline 样式）。
 */
import { useCallback, useEffect, useState } from 'react'
import { Button, Input, Pill } from '@deepseek-ai/dsh-client-ui-primitives'

/** 服务器行（GET /servers）。 */
interface ServerRow {
  id: string
  serverName: string
  transport: 'stdio' | 'streamable-http'
  endpoint: string
  toolCount: number
  status: 'connected' | 'connecting' | 'disconnected'
  config: {
    serverName: string
    transport: 'stdio' | 'streamable-http'
    command?: string
    args?: string[]
    env?: Record<string, string>
    cwd?: string
    url?: string
    headers?: Record<string, string>
    toolCallTimeoutMs?: number
    failOnStartupError?: boolean
  }
}

/** 工具浏览分组（GET /tools）。 */
interface ToolGroups {
  [serverName: string]: Array<{ name: string; rawName: string; description: string }>
}

/* ---- 设计语言（对齐 plugin-console / 官方「模型」页） ---- */
const sectionStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720,
  color: 'var(--dsw-alias-label-primary)',
}
const titleStyle: React.CSSProperties = {
  margin: 0, fontSize: 16, lineHeight: '24px', fontWeight: 500,
  color: 'var(--dsw-alias-label-primary)',
}
const introStyle: React.CSSProperties = {
  margin: 0, fontSize: 14, lineHeight: '22px', color: 'var(--dsw-alias-label-tertiary)',
}
const rowsStyle: React.CSSProperties = {
  margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8,
}
const rowCardStyle: React.CSSProperties = {
  border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 12,
  padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10,
}
const rowHeadStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 28 }
const identityStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1,
}
const nameStyle: React.CSSProperties = {
  fontSize: 14, lineHeight: '22px', fontWeight: 500, color: 'var(--dsw-alias-label-primary)',
}
const metaStyle: React.CSSProperties = {
  fontSize: 11, lineHeight: '16px', color: 'var(--dsw-alias-label-tertiary)',
  fontFamily: 'ui-monospace, monospace',
}
const actionsStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto',
}
const editorStyle: React.CSSProperties = {
  borderRadius: 12, background: 'var(--dsw-alias-bg-module-platform)',
  padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14,
}
const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }
const fieldLabelStyle: React.CSSProperties = {
  fontSize: 12, lineHeight: '18px', fontWeight: 500, color: 'var(--dsw-alias-label-secondary)',
}
const editorActionsStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-end', gap: 8,
}
const errorStyle: React.CSSProperties = {
  margin: 0, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-state-error-primary)',
}
const toolListStyle: React.CSSProperties = {
  margin: '6px 0 0', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4,
  background: 'var(--dsw-alias-bg-module-platform)', borderRadius: 8,
}
const toolRowStyle: React.CSSProperties = {
  fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)',
}
const toolNameStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, monospace', color: 'var(--dsw-alias-label-primary)',
}
const warnStyle: React.CSSProperties = {
  margin: '8px 0 0', fontSize: 11, lineHeight: '16px',
  color: 'var(--dsw-alias-state-warning-primary)',
}

/** 空表单默认值。 */
function emptyForm(transport: 'stdio' | 'streamable-http' = 'stdio'): ServerRow['config'] {
  return transport === 'stdio'
    ? { serverName: '', transport: 'stdio', command: '', args: [], env: {}, cwd: '', toolCallTimeoutMs: 60000, failOnStartupError: false }
    : { serverName: '', transport: 'streamable-http', url: '', headers: {}, toolCallTimeoutMs: 60000, failOnStartupError: false }
}

/** 把键值对 Record 渲染为可编辑文本（每行 key=value）。 */
function recordToText(r: Record<string, string> | undefined): string {
  if (r === undefined) return ''
  return Object.entries(r).map(([k, v]) => `${k}=${v}`).join('\n')
}

/** 把文本（每行 key=value）解析回 Record。 */
function textToRecord(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) { out[trimmed] = '' ; continue }
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return out
}

/** 设置页面板主体。 */
export function McpPanel(): React.ReactNode {
  const [servers, setServers] = useState<ServerRow[]>([])
  const [toolGroups, setToolGroups] = useState<ToolGroups>({})
  const [error, setError] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // 编辑器状态：undefined = 关闭；否则是正在编辑的配置（新建时 id 为空）
  const [editing, setEditing] = useState<{ id: string; config: ServerRow['config'] } | undefined>(undefined)
  const [envText, setEnvText] = useState('')
  const [headersText, setHeadersText] = useState('')

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [serversRes, toolsRes] = await Promise.all([
        fetch('/api/mcp-manager/servers', { headers: { accept: 'application/json' } }),
        fetch('/api/mcp-manager/tools', { headers: { accept: 'application/json' } }),
      ])
      const serversBody = (await serversRes.json()) as { ok?: boolean; servers?: ServerRow[] }
      const toolsBody = (await toolsRes.json()) as { ok?: boolean; groups?: ToolGroups }
      setServers(serversBody.servers ?? [])
      setToolGroups(toolsBody.groups ?? {})
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  /**
   * 自动轮询：存在「连接中」服务器时每 2s 刷新一次（mcp-client 挂载/握手有延迟，
   * 工具注册后状态会变为 connected）；全部稳定后停止轮询。避免面板长时间卡在
   * 误导性的「未连接」——连接中显示「连接中…」并自动追上到「已连接」。
   */
  useEffect(() => {
    const hasConnecting = servers.some(s => s.status === 'connecting')
    if (!hasConnecting) return
    const timer = setInterval(() => { void refresh() }, 2_000)
    return () => clearInterval(timer)
  }, [servers, refresh])

  /** 打开新增表单。 */
  const startAdd = useCallback((): void => {
    const config = emptyForm('stdio')
    setEditing({ id: '', config })
    setEnvText('')
    setHeadersText('')
    setError(undefined)
  }, [])

  /** 打开编辑表单。 */
  const startEdit = useCallback((row: ServerRow): void => {
    setEditing({ id: row.id, config: { ...row.config } })
    setEnvText(recordToText(row.config.env))
    setHeadersText(recordToText(row.config.headers))
    setError(undefined)
  }, [])

  /** 切换 transport（重置字段组）。 */
  const switchTransport = useCallback((transport: 'stdio' | 'streamable-http'): void => {
    setEditing(prev => prev === undefined ? prev : { ...prev, config: emptyForm(transport) })
    setEnvText('')
    setHeadersText('')
  }, [])

  /** 保存（新增或更新）。 */
  const save = useCallback(async (): Promise<void> => {
    if (editing === undefined) return
    setBusy(true)
    setError(undefined)
    try {
      const config = { ...editing.config }
      if (config.transport === 'stdio') {
        config.env = textToRecord(envText)
      } else {
        config.headers = textToRecord(headersText)
      }
      const isEdit = editing.id.length > 0
      const res = await fetch(
        isEdit ? `/api/mcp-manager/servers/${encodeURIComponent(editing.id)}` : '/api/mcp-manager/servers',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(isEdit ? { config } : { config }),
        },
      )
      const body = (await res.json()) as { ok?: boolean; message?: string; field?: string }
      if (body.ok !== true) throw new Error(body.message ?? 'save failed')
      setEditing(undefined)
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }, [editing, envText, headersText, refresh])

  /** 删除。 */
  const remove = useCallback(async (id: string): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const res = await fetch(`/api/mcp-manager/servers/${encodeURIComponent(id)}`, { method: 'DELETE' })
      const body = (await res.json()) as { ok?: boolean; message?: string }
      if (body.ok !== true) throw new Error(body.message ?? 'delete failed')
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }, [refresh])

  /** 展开/折叠工具浏览。 */
  const toggleExpand = useCallback((id: string): void => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const c = editing?.config
  const isStdio = c?.transport === 'stdio'

  return (
    <section style={sectionStyle}>
      <h2 style={titleStyle}>MCP 服务器</h2>
      <p style={introStyle}>
        管理 MCP 服务器连接。每台服务器由官方 <code>@deepseek-ai/dsh-mcp-client</code> 挂载，
        工具以 <code>mcp__&lt;serverName&gt;__*</code> 命名注册。配置写入 profile patch，HMR 实时生效。
      </p>
      <p style={warnStyle}>
        ⚠ env / headers 以明文存入 profile cordis.patch.yml（与官方示例同形态）。勿放长期密钥。
      </p>

      {error !== undefined && <p style={errorStyle}>{error}</p>}

      {loading
        ? <p style={introStyle}>加载中…</p>
        : (
          <div style={rowsStyle}>
            {servers.map(row => (
              <div key={row.id} style={rowCardStyle}>
                <div style={rowHeadStyle}>
                  <span style={identityStyle}>
                    <span style={nameStyle}>{row.config.serverName}</span>
                    {row.status === 'connected'
                      ? <Pill active>{row.toolCount} 工具</Pill>
                      : row.status === 'connecting'
                        ? <Pill>连接中…</Pill>
                        : <Pill>未连接</Pill>}
                  </span>
                  <span style={actionsStyle}>
                    <Button onClick={() => toggleExpand(row.id)} disabled={busy}>
                      {expanded.has(row.id) ? '收起' : '工具'}
                    </Button>
                    <Button onClick={() => startEdit(row)} disabled={busy}>编辑</Button>
                    <Button onClick={() => void remove(row.id)} disabled={busy}>删除</Button>
                  </span>
                </div>
                <span style={metaStyle}>
                  {row.transport} · {row.endpoint} · id: {row.id}
                </span>
                {expanded.has(row.id) && (
                  <div style={toolListStyle}>
                    {(toolGroups[row.config.serverName] ?? []).length === 0
                      ? <span style={toolRowStyle}>（无已注册工具——服务器未连接或未同步）</span>
                      : toolGroups[row.config.serverName]!.map(t => (
                        <div key={t.name} style={toolRowStyle}>
                          <span style={toolNameStyle}>{t.rawName}</span>
                          {t.description !== undefined && t.description.length > 0 ? ` — ${t.description}` : ''}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
            {servers.length === 0 && <p style={introStyle}>尚无 MCP 服务器。点击「新增」添加。</p>}
          </div>
        )}

      <div style={editorActionsStyle}>
        {editing === undefined && <Button onClick={startAdd} disabled={busy}>+ 新增服务器</Button>}
      </div>

      {editing !== undefined && c !== undefined && (
        <div style={editorStyle}>
          <div style={fieldStyle}>
            <label style={fieldLabelStyle}>传输方式</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => switchTransport('stdio')} disabled={busy}>
                {isStdio ? '✓ stdio' : 'stdio'}
              </Button>
              <Button onClick={() => switchTransport('streamable-http')} disabled={busy}>
                {!isStdio ? '✓ streamable-http' : 'streamable-http'}
              </Button>
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={fieldLabelStyle}>serverName（工具命名空间，唯一）</label>
            <Input
              value={c.serverName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditing(p => p === undefined ? p : { ...p, config: { ...p.config, serverName: e.target.value } })}
              disabled={busy}
              placeholder="github"
            />
          </div>

          {isStdio ? (
            <>
              <div style={fieldStyle}>
                <label style={fieldLabelStyle}>command</label>
                <Input
                  value={c.command ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditing(p => p === undefined ? p : { ...p, config: { ...p.config, command: e.target.value } })}
                  disabled={busy}
                  placeholder="npx"
                />
              </div>
              <div style={fieldStyle}>
                <label style={fieldLabelStyle}>args（每行一个）</label>
                <textarea
                  value={(c.args ?? []).join('\n')}
                  onChange={(e) => setEditing(p => p === undefined ? p : { ...p, config: { ...p.config, args: e.target.value.split('\n') } })}
                  disabled={busy}
                  rows={3}
                  style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', padding: '8px 10px' }}
                  placeholder={'-y\n@modelcontextprotocol/server-github'}
                />
              </div>
              <div style={fieldStyle}>
                <label style={fieldLabelStyle}>env（每行 key=value，明文存储）</label>
                <textarea
                  value={envText}
                  onChange={(e) => setEnvText(e.target.value)}
                  disabled={busy}
                  rows={3}
                  style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', padding: '8px 10px' }}
                  placeholder="GITHUB_TOKEN=ghp_xxx"
                />
              </div>
              <div style={fieldStyle}>
                <label style={fieldLabelStyle}>cwd（可空）</label>
                <Input
                  value={c.cwd ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditing(p => p === undefined ? p : { ...p, config: { ...p.config, cwd: e.target.value } })}
                  disabled={busy}
                  placeholder=""
                />
              </div>
            </>
          ) : (
            <>
              <div style={fieldStyle}>
                <label style={fieldLabelStyle}>url</label>
                <Input
                  value={c.url ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditing(p => p === undefined ? p : { ...p, config: { ...p.config, url: e.target.value } })}
                  disabled={busy}
                  placeholder="https://mcp.example.com/mcp"
                />
              </div>
              <div style={fieldStyle}>
                <label style={fieldLabelStyle}>headers（每行 key=value，明文存储）</label>
                <textarea
                  value={headersText}
                  onChange={(e) => setHeadersText(e.target.value)}
                  disabled={busy}
                  rows={3}
                  style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', padding: '8px 10px' }}
                  placeholder="Authorization=Bearer xxx"
                />
              </div>
            </>
          )}

          <div style={fieldStyle}>
            <label style={fieldLabelStyle}>toolCallTimeoutMs</label>
            <Input
              type="number"
              value={String(c.toolCallTimeoutMs ?? 60000)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditing(p => p === undefined ? p : { ...p, config: { ...p.config, toolCallTimeoutMs: Number(e.target.value) || 60000 } })}
              disabled={busy}
            />
          </div>

          <div style={editorActionsStyle}>
            <Button onClick={() => setEditing(undefined)} disabled={busy}>取消</Button>
            <Button onClick={() => void save()} disabled={busy}>
              {editing.id.length > 0 ? '保存' : '添加'}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
