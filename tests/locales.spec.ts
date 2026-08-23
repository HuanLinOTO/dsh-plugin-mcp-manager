/**
 * Locale spec for the MCP panel copy: en/zh key-set parity, the 19
 * better-locale override dictionaries key-set-equal to zh, and the
 * `{count}` placeholder surviving interpolation.
 */
import { describe, expect, it } from 'vitest'
import { en, makeT, zh, type McpManagerKey } from '../src/client/locales.ts'
import { dicts } from '../src/client/dictionaries.ts'

const zhKeys = Object.keys(zh).sort()
const enKeys = Object.keys(en).sort()

describe('locales (key parity)', () => {
  it('keeps the zh and en dictionaries key-set-equal', () => {
    expect(enKeys).toEqual(zhKeys)
  })

  it('keeps every better-locale override dictionary key-set-equal to zh', () => {
    expect(Object.keys(dicts)).toEqual([
      'ja', 'de', 'fr', 'pt', 'ko', 'ar', 'hi', 'id', 'tr', 'vi', 'th',
      'ru', 'it', 'nl', 'sv', 'pl', 'zh-HK', 'zh-TW', 'zh-MO',
    ])
    for (const [lang, dict] of Object.entries(dicts)) {
      expect(Object.keys(dict).sort(), `dict "${lang}"`).toEqual(zhKeys)
    }
  })

  it('ships only the 19 better-locale override languages', () => {
    expect(Object.keys(dicts)).toHaveLength(19)
  })
})

describe('makeT (translation + interpolation)', () => {
  it('interpolates the {count} placeholder of toolCount', () => {
    expect(makeT(en)('toolCount', { count: 3 })).toBe('3 tools')
    expect(makeT(zh)('toolCount', { count: 3 })).toBe('3 工具')
  })

  it('keeps the placeholder when its param is missing', () => {
    expect(makeT(en)('toolCount')).toBe('{count} tools')
  })

  it('reads bare keys without params', () => {
    expect(makeT(en)('cancel')).toBe('Cancel')
    expect(makeT(zh)('addServer')).toBe('+ 新增服务器')
  })
})

describe('dictionaries (translation integrity)', () => {
  it('resolves every override value to a non-empty string', () => {
    for (const [lang, dict] of Object.entries(dicts)) {
      for (const key of zhKeys as McpManagerKey[]) {
        const value = dict[key]
        expect(value, `${lang} → ${key}`).toBeTruthy()
        expect(value, `${lang} → ${key}`).not.toBe(key)
      }
    }
  })

  it('preserves the {count} placeholder in every toolCount translation', () => {
    for (const [lang, dict] of Object.entries(dicts)) {
      expect(dict.toolCount, `${lang} toolCount`).toContain('{count}')
    }
  })
})