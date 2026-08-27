/**
 * dsh-mcp-manager browser half：设置页「MCP」面板。
 * - 服务器列表：serverName + 传输 + 端点 + 状态 Pill + 工具数 + 编辑/删除
 * - 新增/编辑表单：transport 切换（stdio ↔ streamable-http 字段组联动）
 * - 工具浏览：点击服务器展开其 mcp__ 工具列表（只读）
 *
 * fetch 自建路由 /api/mcp-manager，零官方改动。token 走 --dsw-alias-*。
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the ctx.slots Context merge (SlotRegistry) — the runtime
// service lives in ui-renderer since the client-runtime split (v0.1.2-alpha.1).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the SlotMap merge declaring 'settings.section' (the slot
// this plugin registers into).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the ctx.locale Context merge (LocaleRuntime) so the
// apply body can register the plugin's own copy namespace.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { McpPanel } from './Panel.tsx'
import { NS, en, zh } from './locales.ts'
import { dicts } from './dictionaries.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh-plugin-mcp-manager': import('./locales.ts').McpManagerKey
  }
}

/** Cordis 插件名。 */
export const name = 'dsh-mcp-manager-client'

/** 需要 slots（settings.section 插槽）+ locale（面板文案 zh/en）。 */
export const inject = ['slots', 'locale']

/** Structural view of better-locale's override store (optional; no runtime dep). */
interface BetterLocaleOverrideStore {
  register(ns: string, dicts: Record<string, Record<string, string>>): () => void
}

/** 注册设置页「MCP」面板。 */
export function apply(ctx: Context): void {
  // 插件自有文案命名空间，跟随 DSH 原生 zh/en。
  ctx.effect(
    () => ctx.locale.register(NS, { zh, en }),
    'dsh-plugin-mcp-manager: own copy namespace',
  )

  ctx.slots.inject('settings.section', () =>
    ctx.slots.register({
      name: 'settings.section',
      id: 'dsh-mcp-manager',
      order: 61,
      label: () => 'MCP',
      locale: NS,
      inject: () => ({}),
    }, McpPanel))

  // better-locale override: register the 19-language dicts so a selected
  // override language (with DSH on 'en') replaces the panel copy. The
  // service is optional — no better-locale, no dicts.
  // Activation-order-safe: re-check ctx.get('betterLocale') on every locale
  // revision bump (better-locale bumps on activation + override switch).
  ctx.effect(() => {
    let dispose: (() => void) | undefined
    const sync = (): void => {
      dispose?.()
      dispose = undefined
      const store = ctx.get('betterLocale') as BetterLocaleOverrideStore | undefined
      if (store !== undefined) {
        dispose = store.register(NS, dicts)
      }
    }
    sync()
    const unsubscribe = ctx.locale.subscribe(sync)
    return () => {
      unsubscribe()
      dispose?.()
    }
  }, 'dsh-plugin-mcp-manager: better-locale override dicts')
}