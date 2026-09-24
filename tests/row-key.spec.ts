/**
 * 行配置 key 一致性守卫：`plugins.row.config` 的 key 是精确字符串匹配
 * （写错即静默无入口——interpreters 曾把包名段写漏），本规格把三方
 * （cordis.patch.yml 行 id / package.json 包名 / ROW_KEY 派生）钉死。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { ENTRY_ID, PKG_NAME, ROW_KEY } from '../src/client/row-key.ts'

describe('plugins.row.config key derivation', () => {
  it('derives ROW_KEY as <package name>#<row id>', () => {
    expect(PKG_NAME).toBe('@huanlin/dsh-plugin-mcp-manager')
    expect(ENTRY_ID).toBe('dsh-mcp-manager')
    expect(ROW_KEY).toBe(`${PKG_NAME}#${ENTRY_ID}`)
    expect(ROW_KEY).toBe('@huanlin/dsh-plugin-mcp-manager#dsh-mcp-manager')
  })

  it('keeps PKG_NAME equal to the package.json name', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { name: string }
    expect(pkg.name).toBe(PKG_NAME)
  })

  it("keeps ENTRY_ID equal to this bundle's insert row id in cordis.patch.yml", () => {
    const doc = parse(readFileSync(join(process.cwd(), 'cordis.patch.yml'), 'utf8')) as
      Array<{ insert?: Array<{ id?: string; name?: string }> }>
    const rows = (doc ?? []).flatMap(block => block.insert ?? [])
    const own = rows.filter(row => row.name === PKG_NAME)
    expect(own, '本包在 cordis.patch.yml 恰好声明一行').toHaveLength(1)
    expect(own[0]?.id).toBe(ENTRY_ID)
  })
})
