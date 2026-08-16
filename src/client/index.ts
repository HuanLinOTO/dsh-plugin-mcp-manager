/**
 * dsh-mcp-manager browser half：设置页「MCP」面板。
 * - 服务器列表：serverName + 传输 + 端点 + 状态 Pill + 工具数 + 编辑/删除
 * - 新增/编辑表单：transport 切换（stdio ↔ streamable-http 字段组联动）
 * - 工具浏览：点击服务器展开其 mcp__ 工具列表（只读）
 *
 * fetch 自建路由 /api/mcp-manager，零官方改动。token 走 --dsw-alias-*。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { McpPanel } from './Panel.tsx'

/** Cordis 插件名。 */
export const name = 'dsh-mcp-manager-client'

/** 需要 slots（settings.section 插槽）。 */
export const inject = ['slots']

/** 注册设置页「MCP」面板。 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('settings.section', () =>
    ctx.slots.register({
      name: 'settings.section',
      id: 'dsh-mcp-manager',
      order: 61,
      label: () => 'MCP',
      inject: () => ({}),
    }, McpPanel))
}
