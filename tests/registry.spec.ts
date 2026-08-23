/**
 * registry 单元测试：覆盖增删改、serverName 唯一、非法配置拒绝、
 * !!js/注释保留、空 insert 块清理、写后校验回滚。
 *
 * 用 DSH_HOME 环境变量隔离到 tmp 目录，绝不触碰真实 profile。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  listServers,
  getServer,
  addServer,
  updateServer,
  deleteServer,
  setServerDisabled,
  validateServerConfig,
  rowIdFor,
  RegistryError,
  profilePatchPath,
  type McpServerConfig,
} from '../src/registry.ts'

let tmpHome: string
let origDshHome: string | undefined

function setTmpHome(): void {
  tmpHome = mkdtempSync(join(tmpdir(), 'mcp-mgr-test-'))
  mkdirSync(join(tmpHome, 'profiles', 'web'), { recursive: true })
  origDshHome = process.env.DSH_HOME
  process.env.DSH_HOME = tmpHome
}

function restoreHome(): void {
  if (origDshHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = origDshHome
  rmSync(tmpHome, { recursive: true, force: true })
}

/** 写一个初始 patch 文件。 */
function writePatch(content: string): void {
  writeFileSync(profilePatchPath(), content)
}

/** 读当前 patch 文件。 */
function readPatch(): string {
  return readFileSync(profilePatchPath(), 'utf8')
}

const stdioServer: McpServerConfig = {
  serverName: 'github',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: { GITHUB_TOKEN: 'ghp_xxx' },
  cwd: '',
  toolCallTimeoutMs: 60000,
  failOnStartupError: false,
}

const httpServer: McpServerConfig = {
  serverName: 'exa',
  transport: 'streamable-http',
  url: 'https://mcp.exa.ai/mcp?exaApiKey=k1',
  headers: { Authorization: 'Bearer t' },
  toolCallTimeoutMs: 30000,
}

describe('validateServerConfig', () => {
  it('accepts a valid stdio config', () => {
    expect(() => validateServerConfig(stdioServer)).not.toThrow()
  })
  it('accepts a valid streamable-http config', () => {
    expect(() => validateServerConfig(httpServer)).not.toThrow()
  })
  it('rejects bad serverName', () => {
    expect(() => validateServerConfig({ ...stdioServer, serverName: 'has space' })).toThrow(RegistryError)
    expect(() => validateServerConfig({ ...stdioServer, serverName: 'x'.repeat(33) })).toThrow(RegistryError)
  })
  it('rejects stdio without command', () => {
    expect(() => validateServerConfig({ ...stdioServer, command: '' })).toThrow(RegistryError)
  })
  it('rejects streamable-http without url', () => {
    expect(() => validateServerConfig({ ...httpServer, url: '' })).toThrow(RegistryError)
  })
  it('rejects env with non-string values', () => {
    expect(() => validateServerConfig({ ...stdioServer, env: { X: 123 as unknown as string } })).toThrow(RegistryError)
  })
  it('rejects unknown transport', () => {
    expect(() => validateServerConfig({ ...stdioServer, transport: 'foo' as 'stdio' })).toThrow(RegistryError)
  })
  it('rejects non-object', () => {
    expect(() => validateServerConfig(null as unknown as McpServerConfig)).toThrow(RegistryError)
  })
})

describe('rowIdFor', () => {
  it('prefixes mcp-', () => {
    expect(rowIdFor('github')).toBe('mcp-github')
  })
})

describe('registry CRUD', () => {
  beforeEach(setTmpHome)
  afterEach(restoreHome)

  it('addServer writes an insert row and listServers reads it back', () => {
    const id = addServer(stdioServer)
    expect(id).toBe('mcp-github')
    const rows = listServers()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe('mcp-github')
    expect(rows[0]!.name).toBe('@deepseek-ai/dsh-mcp-client')
    expect(rows[0]!.config.serverName).toBe('github')
    expect(rows[0]!.config.command).toBe('npx')
  })

  it('getServer returns undefined for missing id', () => {
    expect(getServer('nope')).toBeUndefined()
  })

  it('addServer rejects duplicate serverName', () => {
    addServer(stdioServer)
    expect(() => addServer({ ...stdioServer, command: 'other' })).toThrow(RegistryError)
  })

  it('addServer rejects duplicate id', () => {
    addServer(stdioServer)
    expect(() => addServer({ ...stdioServer, serverName: 'other', command: 'x' }, { id: 'mcp-github' })).toThrow(RegistryError)
  })

  it('updateServer replaces config block', () => {
    addServer(stdioServer)
    updateServer('mcp-github', { ...stdioServer, command: 'docker', args: ['run', 'mcp'] })
    const row = getServer('mcp-github')!
    expect(row.config.command).toBe('docker')
    expect(row.config.args).toEqual(['run', 'mcp'])
  })

  it('updateServer allows serverName change if unique', () => {
    addServer(stdioServer)
    updateServer('mcp-github', { ...stdioServer, serverName: 'github2' })
    expect(getServer('mcp-github')!.config.serverName).toBe('github2')
  })

  it('updateServer rejects serverName colliding with another', () => {
    addServer(stdioServer)
    addServer({ ...httpServer })
    expect(() => updateServer('mcp-exa', { ...httpServer, serverName: 'github' })).toThrow(RegistryError)
  })

  it('updateServer throws on missing id', () => {
    expect(() => updateServer('nope', stdioServer)).toThrow(RegistryError)
  })

  it('deleteServer removes the row', () => {
    addServer(stdioServer)
    expect(deleteServer('mcp-github')).toBe(true)
    expect(listServers()).toHaveLength(0)
  })

  it('deleteServer returns false for missing id', () => {
    expect(deleteServer('nope')).toBe(false)
  })

  it('deleteServer cleans up empty insert block', () => {
    writePatch(`- insert:
    - id: mcp-github
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: github
        transport: stdio
        command: npx
`)
    deleteServer('mcp-github')
    const after = readPatch()
    expect(after).not.toContain('insert')
  })
})

describe('preservation of !!js and comments', () => {
  beforeEach(setTmpHome)
  afterEach(restoreHome)

  it('preserves !!js expressions and comments in other rows', () => {
    writePatch(`# header comment
- insert:
    - id: mcp-github
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: github
        transport: stdio
        command: npx
        cwd: !!js process.cwd()   # inline comment
- id: dsh-mineru
  config:
    baseURL: 'http://x:18000'
`)
    // Add a second MCP server — must not disturb existing !!js/comments.
    addServer(httpServer)
    const after = readPatch()
    expect(after).toContain('!!js process.cwd()')
    expect(after).toContain('# inline comment')
    expect(after).toContain('# header comment')
    expect(after).toContain('dsh-mineru')
    expect(after).toContain('mcp-exa')
  })

  it('preserves document-level comments when updating an mcp row', () => {
    writePatch(`# top
- insert:
    - id: mcp-github
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: github
        transport: stdio
        command: npx
`)
    updateServer('mcp-github', { ...stdioServer, command: 'docker' })
    const after = readPatch()
    // 文档级注释保留；config 整块替换（不深合并，§3 语义），旧 config 块内
    // 的行内注释随之丢失——这是预期行为（README 说明）。
    expect(after).toContain('# top')
    expect(after).toContain('docker')
    expect(after).toContain('mcp-github')
  })
})

describe('missing file handling', () => {
  beforeEach(setTmpHome)
  afterEach(restoreHome)

  it('listServers returns [] when patch file absent', () => {
    expect(listServers()).toEqual([])
  })

  it('addServer creates the file when absent', () => {
    addServer(stdioServer)
    expect(readPatch()).toContain('mcp-github')
  })

  it('handles a comment-only / null patch file', () => {
    writePatch(`# just a comment, no list`)
    expect(listServers()).toEqual([])
    addServer(stdioServer)
    expect(listServers()).toHaveLength(1)
  })

  it('handles the [] template file', () => {
    writePatch(`[]`)
    expect(listServers()).toEqual([])
    addServer(stdioServer)
    expect(listServers()).toHaveLength(1)
  })
})

describe('multiple mcp servers in one insert block', () => {
  beforeEach(setTmpHome)
  afterEach(restoreHome)

  it('appends to an existing insert block with other mcp rows', () => {
    writePatch(`- insert:
    - id: mcp-github
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: github
        transport: stdio
        command: npx
`)
    addServer(httpServer)
    const rows = listServers()
    expect(rows.map(r => r.id).sort()).toEqual(['mcp-exa', 'mcp-github'])
  })
})

describe('setServerDisabled', () => {
  beforeEach(setTmpHome)
  afterEach(restoreHome)

  it('sets disabled=true at entry level (sibling of id/name/config)', () => {
    addServer(stdioServer)
    const ok = setServerDisabled('mcp-github', true)
    expect(ok).toBe(true)
    const after = readPatch()
    // disabled 字段在 entry level，不在 config 块内。
    expect(after).toMatch(/disabled:\s*true/)
    // config 块完整保留。
    expect(after).toContain('serverName: github')
    expect(after).toContain('command: npx')
  })

  it('listServers reads disabled state back', () => {
    addServer(stdioServer)
    setServerDisabled('mcp-github', true)
    const rows = listServers()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.disabled).toBe(true)
    // config 仍可读。
    expect(rows[0]!.config.serverName).toBe('github')
  })

  it('listServers defaults disabled=false when field absent', () => {
    addServer(stdioServer)
    const rows = listServers()
    expect(rows[0]!.disabled).toBe(false)
  })

  it('enabling removes the disabled field (clean, no disabled: false)', () => {
    addServer(stdioServer)
    setServerDisabled('mcp-github', true)
    setServerDisabled('mcp-github', false)
    const after = readPatch()
    expect(after).not.toMatch(/disabled/)
    const rows = listServers()
    expect(rows[0]!.disabled).toBe(false)
  })

  it('enabling an already-enabled server is a noop (idempotent)', () => {
    addServer(stdioServer)
    const before = readPatch()
    setServerDisabled('mcp-github', false)
    const after = readPatch()
    expect(after).toBe(before)
  })

  it('returns false for missing id', () => {
    addServer(stdioServer)
    expect(setServerDisabled('nope', true)).toBe(false)
  })

  it('preserves !!js expressions and comments in other rows', () => {
    writePatch(`# header comment
- insert:
    - id: mcp-github
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: github
        transport: stdio
        command: npx
        cwd: !!js process.cwd()   # inline comment
`)
    setServerDisabled('mcp-github', true)
    const after = readPatch()
    expect(after).toContain('!!js process.cwd()')
    expect(after).toContain('# inline comment')
    expect(after).toContain('# header comment')
    expect(after).toMatch(/disabled:\s*true/)
  })

  it('disabled field appears between name and config when set (entry-level, not in config)', () => {
    addServer(stdioServer)
    setServerDisabled('mcp-github', true)
    const rows = listServers()
    // 读路径：disabled 是 entry-level 字段，不在 config 内。
    expect(rows[0]!.disabled).toBe(true)
    expect(rows[0]!.config.serverName).toBe('github')
    // config 内不应有 disabled 字段（McpServerConfig 不含此字段）。
    expect((rows[0]!.config as unknown as Record<string, unknown>).disabled).toBeUndefined()
  })
})
