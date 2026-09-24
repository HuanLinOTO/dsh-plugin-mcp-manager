/**
 * Plugins 页行配置（`plugins.row.config`）的 key 派生常量。
 *
 * 三方一致性（破坏任一处，行配置入口即**静默消失**——Plugins 页按
 * `rowConfigKey(pkg, rowId)` 精确字符串匹配 key，不做任何回退提示）：
 * - `ENTRY_ID` = 本 bundle 在 `cordis.patch.yml` 里 insert 行的 `id`
 *   原样透传（同时也是 host 半插件 `name`，见 `src/index.ts`）；
 * - `PKG_NAME` = `package.json` 的 `name`（patch 行 `name` 用包名，B3）；
 * - `ROW_KEY` = `<PKG_NAME>#<ENTRY_ID>`，页面以此键把配置贡献挂到行上。
 *
 * 一致性由 `tests/row-key.spec.ts` 钉死。
 */

/** 本包 npm 包名（= cordis.patch.yml insert 行的 `name`）。 */
export const PKG_NAME = '@huanlin/dsh-plugin-mcp-manager'

/** 本 bundle 组合行 id（= cordis.patch.yml insert 行的 `id` = host 半插件名）。 */
export const ENTRY_ID = 'dsh-mcp-manager'

/** `plugins.row.config` 键：包名 `#` 行 id。 */
export const ROW_KEY = `${PKG_NAME}#${ENTRY_ID}`
