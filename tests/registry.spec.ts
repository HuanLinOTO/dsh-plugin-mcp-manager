/**
 * registry 单元测试：覆盖增删改、serverName 唯一、非法配置拒绝、
 * !!js/注释保留、空 insert 块清理、写后校验回滚。
 *
 * 每个用例的 patch 文件由测试显式给出（临时目录），绝不触碰真实 profile。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  createRegistry,
  validateServerConfig,
  rowIdFor,
  RegistryError,
  type McpRegistry,
  type McpServerConfig,
} from '../src/registry.ts'

let tmpDir: string
let patchPath: string
let reg: McpRegistry

/** 每个用例一个临时 patch 文件——注册表的目标文件由调用方显式给出。 */
function setUpRegistry(): void {
  tmpDir = mkdtempSync(join(tmpdir(), 'mcp-mgr-test-'))
  patchPath = join(tmpDir, 'cordis.patch.yml')
  reg = createRegistry({ patchPath })
}

function tearDownRegistry(): void {
  rmSync(tmpDir, { recursive: true, force: true })
}

/** 写一个初始 patch 文件。 */
function writePatch(content: string): void {
  writeFileSync(patchPath, content)
}

/** 读当前 patch 文件。 */
function readPatch(): string {
  return readFileSync(patchPath, 'utf8')
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
  beforeEach(setUpRegistry)
  afterEach(tearDownRegistry)

  it('addServer writes an insert row and listServers reads it back', () => {
    const id = reg.addServer(stdioServer)
    expect(id).toBe('mcp-github')
    const rows = reg.listServers()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe('mcp-github')
    expect(rows[0]!.name).toBe('@deepseek-ai/dsh-mcp-client')
    expect(rows[0]!.config.serverName).toBe('github')
    expect(rows[0]!.config.command).toBe('npx')
  })

  it('getServer returns undefined for missing id', () => {
    expect(reg.getServer('nope')).toBeUndefined()
  })

  it('addServer rejects duplicate serverName', () => {
    reg.addServer(stdioServer)
    expect(() => reg.addServer({ ...stdioServer, command: 'other' })).toThrow(RegistryError)
  })

  it('addServer rejects duplicate id', () => {
    reg.addServer(stdioServer)
    expect(() => reg.addServer({ ...stdioServer, serverName: 'other', command: 'x' }, { id: 'mcp-github' })).toThrow(RegistryError)
  })

  it('updateServer replaces config block', () => {
    reg.addServer(stdioServer)
    reg.updateServer('mcp-github', { ...stdioServer, command: 'docker', args: ['run', 'mcp'] })
    const row = reg.getServer('mcp-github')!
    expect(row.config.command).toBe('docker')
    expect(row.config.args).toEqual(['run', 'mcp'])
  })

  it('updateServer allows serverName change if unique', () => {
    reg.addServer(stdioServer)
    reg.updateServer('mcp-github', { ...stdioServer, serverName: 'github2' })
    expect(reg.getServer('mcp-github')!.config.serverName).toBe('github2')
  })

  it('updateServer rejects serverName colliding with another', () => {
    reg.addServer(stdioServer)
    reg.addServer({ ...httpServer })
    expect(() => reg.updateServer('mcp-exa', { ...httpServer, serverName: 'github' })).toThrow(RegistryError)
  })

  it('updateServer throws on missing id', () => {
    expect(() => reg.updateServer('nope', stdioServer)).toThrow(RegistryError)
  })

  it('deleteServer removes the row', () => {
    reg.addServer(stdioServer)
    expect(reg.deleteServer('mcp-github')).toBe(true)
    expect(reg.listServers()).toHaveLength(0)
  })

  it('deleteServer returns false for missing id', () => {
    expect(reg.deleteServer('nope')).toBe(false)
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
    reg.deleteServer('mcp-github')
    const after = readPatch()
    expect(after).not.toContain('insert')
  })
})

describe('preservation of !!js and comments', () => {
  beforeEach(setUpRegistry)
  afterEach(tearDownRegistry)

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
    reg.addServer(httpServer)
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
    reg.updateServer('mcp-github', { ...stdioServer, command: 'docker' })
    const after = readPatch()
    // 文档级注释保留；config 整块替换（不深合并，§3 语义），旧 config 块内
    // 的行内注释随之丢失——这是预期行为（README 说明）。
    expect(after).toContain('# top')
    expect(after).toContain('docker')
    expect(after).toContain('mcp-github')
  })
})

describe('missing file handling', () => {
  beforeEach(setUpRegistry)
  afterEach(tearDownRegistry)

  it('listServers returns [] when patch file absent', () => {
    expect(reg.listServers()).toEqual([])
  })

  it('addServer creates the file when absent', () => {
    reg.addServer(stdioServer)
    expect(readPatch()).toContain('mcp-github')
  })

  it('handles a comment-only / null patch file', () => {
    writePatch(`# just a comment, no list`)
    expect(reg.listServers()).toEqual([])
    reg.addServer(stdioServer)
    expect(reg.listServers()).toHaveLength(1)
  })

  it('handles the [] template file', () => {
    writePatch(`[]`)
    expect(reg.listServers()).toEqual([])
    reg.addServer(stdioServer)
    expect(reg.listServers()).toHaveLength(1)
  })
})

describe('multiple mcp servers in one insert block', () => {
  beforeEach(setUpRegistry)
  afterEach(tearDownRegistry)

  it('appends to an existing insert block with other mcp rows', () => {
    writePatch(`- insert:
    - id: mcp-github
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: github
        transport: stdio
        command: npx
`)
    reg.addServer(httpServer)
    const rows = reg.listServers()
    expect(rows.map(r => r.id).sort()).toEqual(['mcp-exa', 'mcp-github'])
  })
})

describe('setServerDisabled', () => {
  beforeEach(setUpRegistry)
  afterEach(tearDownRegistry)

  it('sets disabled=true at entry level (sibling of id/name/config)', () => {
    reg.addServer(stdioServer)
    const ok = reg.setServerDisabled('mcp-github', true)
    expect(ok).toBe(true)
    const after = readPatch()
    // disabled 字段在 entry level，不在 config 块内。
    expect(after).toMatch(/disabled:\s*true/)
    // config 块完整保留。
    expect(after).toContain('serverName: github')
    expect(after).toContain('command: npx')
  })

  it('listServers reads disabled state back', () => {
    reg.addServer(stdioServer)
    reg.setServerDisabled('mcp-github', true)
    const rows = reg.listServers()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.disabled).toBe(true)
    // config 仍可读。
    expect(rows[0]!.config.serverName).toBe('github')
  })

  it('listServers defaults disabled=false when field absent', () => {
    reg.addServer(stdioServer)
    const rows = reg.listServers()
    expect(rows[0]!.disabled).toBe(false)
  })

  it('enabling removes the disabled field (clean, no disabled: false)', () => {
    reg.addServer(stdioServer)
    reg.setServerDisabled('mcp-github', true)
    reg.setServerDisabled('mcp-github', false)
    const after = readPatch()
    expect(after).not.toMatch(/disabled/)
    const rows = reg.listServers()
    expect(rows[0]!.disabled).toBe(false)
  })

  it('enabling an already-enabled server is a noop (idempotent)', () => {
    reg.addServer(stdioServer)
    const before = readPatch()
    reg.setServerDisabled('mcp-github', false)
    const after = readPatch()
    expect(after).toBe(before)
  })

  it('returns false for missing id', () => {
    reg.addServer(stdioServer)
    expect(reg.setServerDisabled('nope', true)).toBe(false)
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
    reg.setServerDisabled('mcp-github', true)
    const after = readPatch()
    expect(after).toContain('!!js process.cwd()')
    expect(after).toContain('# inline comment')
    expect(after).toContain('# header comment')
    expect(after).toMatch(/disabled:\s*true/)
  })

  it('disabled field appears between name and config when set (entry-level, not in config)', () => {
    reg.addServer(stdioServer)
    reg.setServerDisabled('mcp-github', true)
    const rows = reg.listServers()
    // 读路径：disabled 是 entry-level 字段，不在 config 内。
    expect(rows[0]!.disabled).toBe(true)
    expect(rows[0]!.config.serverName).toBe('github')
    // config 内不应有 disabled 字段（McpServerConfig 不含此字段）。
    expect((rows[0]!.config as unknown as Record<string, unknown>).disabled).toBeUndefined()
  })
})
describe('registry binding', () => {
  beforeEach(setUpRegistry)
  afterEach(tearDownRegistry)

  it('two registries write to their own patch file and do not interfere', () => {
    const otherDir = mkdtempSync(join(tmpdir(), 'mcp-mgr-other-'))
    const otherPath = join(otherDir, 'cordis.patch.yml')
    const other = createRegistry({ patchPath: otherPath })
    try {
      reg.addServer(stdioServer)
      other.addServer({ ...stdioServer, serverName: 'other', command: 'x' })
      expect(reg.listServers().map(r => r.config.serverName)).toEqual(['github'])
      expect(other.listServers().map(r => r.config.serverName)).toEqual(['other'])
      // 目标文件就是构造时给的那份，与进程环境（DSH_HOME / profile 名）无关。
      expect(readPatch()).toContain('mcp-github')
      expect(readFileSync(otherPath, 'utf8')).toContain('mcp-other')
    } finally {
      rmSync(otherDir, { recursive: true, force: true })
    }
  })
})
