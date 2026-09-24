/**
 * dsh-mcp-manager browser half：Plugins 页「dsh-mcp-manager」行的配置卡片
 * （`plugins.row.config`，key `@huanlin/dsh-plugin-mcp-manager#dsh-mcp-manager`）。
 * - 服务器列表：serverName + 传输 + 端点 + 状态 Pill + 工具数 + 编辑/删除
 * - 新增/编辑表单：transport 切换（stdio ↔ streamable-http 字段组联动）
 * - 工具浏览：点击服务器展开其 mcp__ 工具列表（只读）
 *
 * 卡片不读 props.form：本插件自身无 volatile Config（面板管理的是官方
 * `@deepseek-ai/dsh-mcp-client` 的 insert 行——这是插件功能而非自身设置），
 * 数据继续走自建路由 /api/mcp-manager，零官方改动。token 走 --dsw-alias-*。
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the ctx.slots Context merge (SlotRegistry) — the runtime
// service lives in ui-renderer since the client-runtime split (v0.1.2-alpha.1).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the SlotMap merge declaring 'plugins.row.config' (the slot
// this plugin registers into; declared by ui-plugin-manager, the Plugins page).
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
// Type-only: pulls the ctx.locale Context merge (LocaleRuntime) so the
// apply body can register the plugin's own copy namespace.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { McpPanel } from './Panel.tsx'
import { NS, en, zh } from './locales.ts'
import { dicts } from './dictionaries.ts'
import { ROW_KEY } from './row-key.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh-plugin-mcp-manager': import('./locales.ts').McpManagerKey
  }
}

/** Cordis 插件名。 */
export const name = 'dsh-mcp-manager-client'

/** 需要 slots（plugins.row.config 插槽）+ locale（卡片文案 zh/en）。 */
export const inject = ['slots', 'locale']

/** Structural view of better-locale's override store (optional; no runtime dep). */
interface BetterLocaleOverrideStore {
  register(ns: string, dicts: Record<string, Record<string, string>>): () => void
}

/**
 * 注册 Plugins 页「dsh-mcp-manager」行的配置卡片。
 *
 * 刻意**不用** `configForms.whileServed` 做 gating：settings describe 会过滤
 * 无 volatile form 的 entry，本插件 entry（自身无 Config）永远不被 serve，
 * gating 等于永久撤回贡献（另一种静默消失）。裸 `slots.inject` 只等插槽
 * 声明本身，ui-plugin-manager 激活即挂上（interpreters 同形态）。
 */
export function apply(ctx: Context): void {
  // 插件自有文案命名空间，跟随 DSH 原生 zh/en。
  ctx.effect(
    () => ctx.locale.register(NS, { zh, en }),
    'dsh-plugin-mcp-manager: own copy namespace',
  )

  // 行配置卡片：key = <包名>#<行id>（三方一致性见 row-key.ts）。owner props
  // 携带 view: 'summary' | 'page'；卡片不读 form（见文件头注）。`t` 座位由
  // 渲染器从 locale: NS 合成。
  ctx.slots.inject('plugins.row.config', function* () {
    yield ctx.slots.register({
      name: 'plugins.row.config',
      key: ROW_KEY,
      locale: NS,
      inject: () => ({}),
    }, McpPanel)
  })

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