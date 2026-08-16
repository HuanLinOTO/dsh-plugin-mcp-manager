/**
 * dsh-mcp-manager 构建：Node half（host 侧，读写 cordis.patch.yml 的
 * mcp-client insert 行 + 注册 /api/mcp-manager 路由 + mcp_* 工具）+
 * client half（浏览器「MCP」设置面板）。0 patch 独立包——不依赖官方
 * monorepo preset，配置无 import（tsdown 支持裸对象导出）。
 *
 * 预构建策略：含 @deepseek-ai/* private peer deps → lib/ 入库，无 prepare
 * 脚本（pnpm 在 git install 的 prepare 阶段拉不到 private 包会失败）。
 */

export default [
  {
    entry: ['src/index.ts'],
    format: 'esm',
    platform: 'node',
    target: 'es2024',
    outDir: 'lib',
    clean: true,
    // bundle 语义：官方包（@deepseek-ai/*）由 profile 的 pnpm 闭包在挂载时
    // 注入——不打包（本地无公共 npm 可解析），与 client 配置同理由。
    external: [/@deepseek-ai\//],
  },
  {
    name: '@huanlin/dsh-plugin-mcp-manager/client',
    entry: { client: 'src/client/index.ts' },
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    outDir: 'lib',
    dts: false,
    clean: false,
    // 官方 client 契约：bundle 调用 window.__ModuleLoader__.load({id, factory})。
    // CJS（ESM 输出与顶层 return 不兼容，浏览器解析失败——对齐 plugin-console）。
    external: [/@deepseek-ai\/dsh-client-/, 'react'],
    outputOptions: {
      entryFileNames: 'index.js',
      banner: 'window.__ModuleLoader__.load({ id: "@huanlin/dsh-plugin-mcp-manager", factory: (require) => { var module = { exports: {} }; var exports = module.exports;',
      footer: 'return exports; } });',
    },
  },
]
