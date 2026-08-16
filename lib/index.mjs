import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { YAMLMap, YAMLSeq, parseDocument } from "yaml";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region src/registry.ts
/**
* MCP 服务器注册表：读写 profile `cordis.patch.yml` 中
* `name: '@deepseek-ai/dsh-mcp-client'` 的 insert 行。
*
* 单一事实来源与官方配置形态一致——每行 = 一个 mcp-client 插件实例，
* 配置 HMR 实时挂载/卸载/热替换，连接生命周期完全委托官方 mcp-client。
*
* 实现要点（对照开发计划 §3）：
* - 用 eemeli `yaml` 的 Document API（parseDocument → 改节点 → toString）
*   而非行级字符串拼接：config 嵌套深，且需保留 `!!js` 表达式与其他行的
*   注释/结构（已实证 eemeli yaml 往返保留 !!js + 注释，js-yaml 默认 schema
*   拒绝 !!js）。
* - 写前用官方 `loadOverlayPatches`（@deepseek-ai/dsh-app-boot）校验可解析，
*   失败则拒绝写入（防写坏用户配置导致 web 启动失败）。
* - serverName 全 profile 唯一（mcp-client 在加载时拒绝重复 serverName）。
* - 编辑既有行：整块替换 config（不深合并），与 loader patch 语义一致。
* - 删除行：移除 insert 块中该 `- id:` 子树；块空则删块。
*
* 零源码 patch：只读写 profile 的用户 patch 层（官方 HMR-watched 文件）。
*/
/** mcp-client insert 行的 name 字段（官方包名，Loader 从 node_modules 解析）。 */
const MCP_CLIENT_PACKAGE = "@deepseek-ai/dsh-mcp-client";
/** serverName 合法字符（与官方 mcp-client SERVER_NAME_PATTERN 一致）。 */
const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
/** 解析 DSH_HOME（官方 dsh-paths 语义）。 */
function resolveDshHome() {
	return process.env.DSH_HOME?.trim() !== "" && process.env.DSH_HOME !== void 0 ? process.env.DSH_HOME : join(process.env.HOME ?? process.env.USERPROFILE ?? "/tmp", ".dsh");
}
/** 当前 profile（web 默认）目录。 */
function profileWebDir() {
	return join(resolveDshHome(), "profiles", "web");
}
/** 当前 profile 的 cordis.patch.yml（用户 patch 层，配置 HMR watched）。 */
function profilePatchPath() {
	return join(profileWebDir(), "cordis.patch.yml");
}
/** 校验错误（携带字段名便于 UI 定位）。 */
var RegistryError = class extends Error {
	field;
	constructor(field, message) {
		super(message);
		this.field = field;
		this.name = "RegistryError";
	}
};
/**
* 校验一个服务器配置。fail loud：非法值抛 RegistryError（携带字段名）。
* 与官方 mcp-client Config schema 语义对齐，但不依赖其运行时（外部插件
* 不能 import mcp-client src；契约以 README 为准）。
*/
function validateServerConfig(config) {
	if (typeof config !== "object" || config === null || Array.isArray(config)) throw new RegistryError("config", "server config must be an object");
	const c = config;
	if (typeof c.serverName !== "string" || !SERVER_NAME_PATTERN.test(c.serverName)) throw new RegistryError("serverName", `serverName must match ${SERVER_NAME_PATTERN.source}`);
	if (c.transport !== "stdio" && c.transport !== "streamable-http") throw new RegistryError("transport", "transport must be 'stdio' or 'streamable-http'");
	if (c.transport === "stdio") {
		if (typeof c.command !== "string" || c.command.length === 0) throw new RegistryError("command", "stdio transport requires a non-empty command");
		if (c.args !== void 0 && (!Array.isArray(c.args) || c.args.some((a) => typeof a !== "string"))) throw new RegistryError("args", "args must be an array of strings");
		if (c.env !== void 0 && (typeof c.env !== "object" || c.env === null || Object.values(c.env).some((v) => typeof v !== "string"))) throw new RegistryError("env", "env must be a string→string map");
		if (c.cwd !== void 0 && typeof c.cwd !== "string") throw new RegistryError("cwd", "cwd must be a string");
	} else {
		if (typeof c.url !== "string" || c.url.length === 0) throw new RegistryError("url", "streamable-http transport requires a non-empty url");
		if (c.headers !== void 0 && (typeof c.headers !== "object" || c.headers === null || Object.values(c.headers).some((v) => typeof v !== "string"))) throw new RegistryError("headers", "headers must be a string→string map");
	}
	if (c.toolCallTimeoutMs !== void 0 && (typeof c.toolCallTimeoutMs !== "number" || c.toolCallTimeoutMs < 1)) throw new RegistryError("toolCallTimeoutMs", "toolCallTimeoutMs must be a positive number");
	if (c.failOnStartupError !== void 0 && typeof c.failOnStartupError !== "boolean") throw new RegistryError("failOnStartupError", "failOnStartupError must be a boolean");
	if (c.reconnect !== void 0) {
		if (typeof c.reconnect !== "object" || c.reconnect === null) throw new RegistryError("reconnect", "reconnect must be an object");
		const r = c.reconnect;
		if (r.enabled !== void 0 && typeof r.enabled !== "boolean") throw new RegistryError("reconnect.enabled", "reconnect.enabled must be a boolean");
		for (const key of [
			"initialDelayMs",
			"maxDelayMs",
			"maxAttempts"
		]) if (r[key] !== void 0 && (typeof r[key] !== "number" || r[key] < 1)) throw new RegistryError(`reconnect.${key}`, `reconnect.${key} must be a positive number`);
	}
}
/** 生成 insert 行 id：mcp-<serverName>（serverName 已校验合法）。 */
function rowIdFor(serverName) {
	return `mcp-${serverName}`;
}
/** 一个新的空列表文档（每次调用返回新实例，避免共享可变状态）。 */
function emptyPatchDocument() {
	return parseDocument("[]\n");
}
/** 读取 patch 文件的 Document（保留注释/!!js）；文件不存在返回空文档。 */
function readPatchDocument() {
	const file = profilePatchPath();
	let content;
	try {
		content = readFileSync(file, "utf8");
	} catch {
		return emptyPatchDocument();
	}
	const doc = parseDocument(content);
	if (!(doc.contents instanceof YAMLSeq)) return emptyPatchDocument();
	return doc;
}
/** 收集所有 insert 块中的 mcp-client 行（跨多个 insert 块，容错）。 */
function collectMcpRows(doc) {
	const out = [];
	const seq = doc.contents;
	for (const entry of seq.items) {
		if (!(entry instanceof YAMLMap)) continue;
		const insertNode = entry.get("insert", true);
		if (!(insertNode instanceof YAMLSeq)) continue;
		const block = insertNode;
		for (let i = 0; i < block.items.length; i += 1) {
			const row = block.items[i];
			if (!(row instanceof YAMLMap)) continue;
			if (row.get("name") !== "@deepseek-ai/dsh-mcp-client") continue;
			const id = typeof row.get("id") === "string" ? row.get("id") : "";
			out.push({
				block,
				index: i,
				row,
				id
			});
		}
	}
	return out;
}
/** 将 McpServerConfig 转为纯 YAML 数据（用于 set 创建节点）。 */
function configToData(config) {
	return { ...config };
}
/**
* 读全部 MCP 服务器行。配置块缺失/结构异常的行被跳过（不抛——读路径容忍）。
* 返回每行的 id 与解析出的 config（仅含存在的字段）。
*/
function listServers() {
	const doc = readPatchDocument();
	const rows = collectMcpRows(doc);
	const out = [];
	for (const { row, id } of rows) {
		const cfgNode = row.get("config", true);
		if (!(cfgNode instanceof YAMLMap)) continue;
		let config;
		try {
			config = cfgNode.toJS(doc);
		} catch {
			continue;
		}
		out.push({
			id,
			name: MCP_CLIENT_PACKAGE,
			config
		});
	}
	return out;
}
/** 写回 patch 文件并校验：可选 app-boot 校验器在场则用之，否则仅保证可解析。 */
function writeAndValidate(doc, loadOverlayPatches) {
	const file = profilePatchPath();
	const text = doc.toString();
	let previous = null;
	try {
		previous = readFileSync(file, "utf8");
	} catch {
		previous = null;
	}
	writeFileSync(file, text);
	if (loadOverlayPatches !== void 0) try {
		loadOverlayPatches("dsh-mcp-manager", file);
	} catch (error) {
		if (previous !== null) writeFileSync(file, previous);
		throw new RegistryError("patch", `写入后校验失败（已回滚）: ${error instanceof Error ? error.message : String(error)}`);
	}
}
/**
* 尝试动态解析官方 app-boot 的 loadOverlayPatches（可选 peer）。
* 未安装/不可导入时返回 undefined（降级为仅可解析检查——eemeli yaml 序列化
* 保证输出是合法 YAML 数组，写坏风险已极低）。
*/
function resolveLoadOverlayPatches() {
	try {
		const mod = createRequire(import.meta.url)("@deepseek-ai/dsh-app-boot");
		return typeof mod.loadOverlayPatches === "function" ? mod.loadOverlayPatches : void 0;
	} catch {
		return;
	}
}
/**
* 新增一个 MCP 服务器。校验配置 + serverName 唯一 → 写 insert 行。
* @param config 服务器配置（纯数据）。
* @param id 可选行 id；默认 mcp-<serverName>。
* @param loadOverlayPatches 可选官方校验器（app-boot 提供）。
* @returns 新增行的 id。
* @throws RegistryError 配置非法 / serverName 重复 / id 重复 / 写后校验失败。
*/
function addServer(config, opts) {
	validateServerConfig(config);
	const id = (opts?.id ?? rowIdFor(config.serverName)).trim();
	if (id.length === 0) throw new RegistryError("id", "id must be non-empty");
	const doc = readPatchDocument();
	const existing = collectMcpRows(doc);
	if (existing.some((r) => {
		const cfg = r.row.get("config", true);
		if (!(cfg instanceof YAMLMap)) return false;
		return cfg.get("serverName") === config.serverName;
	})) throw new RegistryError("serverName", `serverName "${config.serverName}" is already in use`);
	if (existing.some((r) => r.id === id)) throw new RegistryError("id", `id "${id}" is already in use`);
	const seq = doc.contents;
	let targetBlock;
	for (const entry of seq.items) {
		if (!(entry instanceof YAMLMap)) continue;
		const insertNode = entry.get("insert", true);
		if (insertNode instanceof YAMLSeq) {
			targetBlock = insertNode;
			break;
		}
	}
	if (targetBlock === void 0) {
		const insertEntry = new YAMLMap();
		const newBlock = new YAMLSeq();
		insertEntry.set("insert", newBlock);
		seq.add(insertEntry);
		targetBlock = newBlock;
	}
	const row = new YAMLMap();
	row.set("id", id);
	row.set("name", MCP_CLIENT_PACKAGE);
	row.set("config", doc.createNode(configToData(config)));
	targetBlock.add(row);
	writeAndValidate(doc, opts?.loadOverlayPatches);
	console.log(`[dsh-mcp-manager] added server ${id} (serverName=${config.serverName})`);
	return id;
}
/**
* 更新一个服务器（整块替换 config）。serverName 可改（需保持唯一）。
* @throws RegistryError 配置非法 / id 不存在 / serverName 与他人冲突 / 写后校验失败。
*/
function updateServer(id, config, opts) {
	validateServerConfig(config);
	const doc = readPatchDocument();
	const rows = collectMcpRows(doc);
	const target = rows.find((r) => r.id === id);
	if (target === void 0) throw new RegistryError("id", `server "${id}" not found`);
	for (const r of rows) {
		if (r.id === id) continue;
		const cfg = r.row.get("config", true);
		if (!(cfg instanceof YAMLMap)) continue;
		if (cfg.get("serverName") === config.serverName) throw new RegistryError("serverName", `serverName "${config.serverName}" is already in use by "${r.id}"`);
	}
	target.row.set("config", doc.createNode(configToData(config)));
	writeAndValidate(doc, opts?.loadOverlayPatches);
	console.log(`[dsh-mcp-manager] updated server ${id}`);
}
/**
* 删除一个服务器行。空掉的 insert 块一并删除（空 insert 是脏 patch）。
* @returns true 删除成功；false 行不存在。
*/
function deleteServer(id, opts) {
	const doc = readPatchDocument();
	const target = collectMcpRows(doc).find((r) => r.id === id);
	if (target === void 0) return false;
	target.block.delete(target.index);
	if (target.block.items.length === 0) {
		const seq = doc.contents;
		for (let i = 0; i < seq.items.length; i += 1) {
			const entry = seq.items[i];
			if (!(entry instanceof YAMLMap)) continue;
			const insertNode = entry.get("insert", true);
			if (insertNode instanceof YAMLSeq && insertNode === target.block) {
				seq.delete(i);
				break;
			}
		}
	}
	writeAndValidate(doc, opts?.loadOverlayPatches);
	console.log(`[dsh-mcp-manager] deleted server ${id}`);
	return true;
}
//#endregion
//#region src/tools.ts
/**
* MCP 管理工具（mcp_* ×4）：agent 面的服务器注册表管理（对齐开发计划 §M4）。
* 与 GUI 面板写同一安装态（profile cordis.patch.yml 的 mcp-client insert 行），
* 配置 HMR 实时挂载——agent 调用后工具立即可用（若服务器连接成功）。
*
* - mcp_server_list：列出全部 MCP 服务器 + 每个的已注册工具数（运行态）
* - mcp_server_add：新增服务器（校验 + 写 insert 行 → HMR 挂载 mcp-client 实例）
* - mcp_server_update：整块替换 config（serverName 不变则工具名不变）
* - mcp_server_remove：移除行 → 工具随实例 dispose 注销
*
* 依赖注入（deps）：避免与 index.ts 循环依赖。连接生命周期完全委托官方
* mcp-client——管理插件只写配置，不拉连接。
*/
/** 把注册表行 + 运行态工具名投影为 agent 可见的规范视图。 */
function toServerView(row, toolNames, connectingSince) {
	const prefix = `mcp__${row.config.serverName}__`;
	const toolCount = toolNames.filter((n) => n.startsWith(prefix)).length;
	const endpoint = row.config.transport === "stdio" ? `${row.config.command ?? ""} ${(row.config.args ?? []).join(" ")}`.trim() : row.config.url ?? "";
	let status;
	if (toolCount > 0) status = "connected";
	else {
		const since = connectingSince.get(row.config.serverName);
		status = since !== void 0 && Date.now() - since < 3e4 ? "connecting" : "disconnected";
	}
	return {
		id: row.id,
		serverName: row.config.serverName,
		transport: row.config.transport,
		endpoint,
		toolCount,
		status
	};
}
function renderServers(_args, value) {
	if (value.servers.length === 0) return [{
		type: "text",
		text: "(no MCP servers registered)"
	}];
	return [{
		type: "text",
		text: value.servers.map((s) => `- ${s.id} [${s.status}] ${s.transport} · ${s.serverName} · ${s.toolCount} tool(s) · ${s.endpoint}`).join("\n")
	}];
}
/** 共享参数 schema（add/update 用同一组字段描述）。 */
const SERVER_PARAMS = {
	serverName: {
		type: "string",
		required: true,
		description: "Stable namespace for tool names (mcp__<serverName>__*). Must match [A-Za-z0-9_-]{1,32} and be unique."
	},
	transport: {
		type: "string",
		required: true,
		description: "Transport: 'stdio' (spawned child process) or 'streamable-http' (SSE)."
	},
	command: {
		type: "string",
		description: "stdio: executable to start the server."
	},
	args: {
		type: "array",
		items: { type: "string" },
		description: "stdio: arguments passed to the command."
	},
	env: {
		type: "object",
		additionalProperties: true,
		description: "stdio: extra env vars (string→string). WARNING: stored in plaintext in the profile patch file."
	},
	cwd: {
		type: "string",
		description: "stdio: working directory."
	},
	url: {
		type: "string",
		description: "streamable-http: MCP endpoint URL."
	},
	headers: {
		type: "object",
		additionalProperties: true,
		description: "streamable-http: additional headers (string→string). WARNING: stored in plaintext."
	},
	toolCallTimeoutMs: {
		type: "number",
		description: "Per-tool-call timeout in ms (default 60000)."
	},
	failOnStartupError: {
		type: "boolean",
		description: "Fail plugin activation on initial connection error (default false)."
	}
};
/** 从 defineTool 的 args（JsonValue 宽类型）构造 McpServerConfig。 */
function configFromArgs(args) {
	const config = {
		serverName: String(args.serverName ?? ""),
		transport: args.transport === "streamable-http" ? "streamable-http" : "stdio"
	};
	if (typeof args.command === "string") config.command = args.command;
	if (Array.isArray(args.args)) config.args = args.args.map(String);
	if (args.env !== null && typeof args.env === "object") config.env = Object.fromEntries(Object.entries(args.env).map(([k, v]) => [k, String(v)]));
	if (typeof args.cwd === "string") config.cwd = args.cwd;
	if (typeof args.url === "string") config.url = args.url;
	if (args.headers !== null && typeof args.headers === "object") config.headers = Object.fromEntries(Object.entries(args.headers).map(([k, v]) => [k, String(v)]));
	if (typeof args.toolCallTimeoutMs === "number") config.toolCallTimeoutMs = args.toolCallTimeoutMs;
	if (typeof args.failOnStartupError === "boolean") config.failOnStartupError = args.failOnStartupError;
	return config;
}
function createMcpTools(deps) {
	return [
		defineTool({
			name: "mcp_server_list",
			description: "List registered MCP servers and their live tool counts. Each server is an @deepseek-ai/dsh-mcp-client instance mounted from the profile cordis.patch.yml insert row. status: connected (tools registered), connecting (mcp-client mounting/handshaking within the post-write grace window), disconnected (0 tools past the grace window — failed/exhausted).",
			parameters: {},
			output: {
				schema: {
					type: "object",
					additionalProperties: false,
					properties: { servers: {
						type: "array",
						required: true,
						items: {
							type: "object",
							additionalProperties: false,
							properties: {
								id: {
									type: "string",
									required: true
								},
								serverName: {
									type: "string",
									required: true
								},
								transport: {
									type: "string",
									required: true
								},
								endpoint: {
									type: "string",
									required: true
								},
								toolCount: {
									type: "number",
									required: true
								},
								status: {
									type: "string",
									required: true,
									enum: [
										"connected",
										"connecting",
										"disconnected"
									]
								}
							}
						}
					} }
				},
				render: renderServers
			},
			async execute() {
				const toolNames = deps.registeredToolNames();
				return { servers: deps.listServers().map((r) => toServerView(r, toolNames, deps.connectingSince)) };
			}
		}),
		defineTool({
			name: "mcp_server_add",
			description: "Register a new MCP server. Writes an mcp-client insert row into the profile cordis.patch.yml; the config HMR mounts the @deepseek-ai/dsh-mcp-client instance live (no restart). Connection lifecycle is delegated to the official mcp-client. env/headers are stored in PLAINTEXT — do not put long-lived secrets there without accepting the risk.",
			parameters: SERVER_PARAMS,
			output: {
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						ok: {
							type: "boolean",
							required: true
						},
						id: {
							type: "string",
							required: true
						},
						message: {
							type: "string",
							required: true
						}
					}
				},
				render: (_args, value) => [{
					type: "text",
					text: value.message
				}]
			},
			async execute(args) {
				const config = configFromArgs(args);
				const id = deps.addServer(config);
				return {
					ok: true,
					id: String(id),
					message: `mcp_server_add: registered "${config.serverName}" (id ${id}) — config HMR is mounting the mcp-client instance; tools will appear as mcp__${config.serverName}__* once the connection succeeds.`
				};
			}
		}),
		defineTool({
			name: "mcp_server_update",
			description: "Update an MCP server config (replaces the whole config block, no deep merge). If serverName is unchanged, the public tool names stay the same; the mcp-client instance hot-swaps (disconnect + reconnect). serverName changes require uniqueness.",
			parameters: {
				id: {
					type: "string",
					required: true,
					description: "The server insert-row id (e.g. mcp-github)."
				},
				...SERVER_PARAMS
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						ok: {
							type: "boolean",
							required: true
						},
						id: {
							type: "string",
							required: true
						},
						message: {
							type: "string",
							required: true
						}
					}
				},
				render: (_args, value) => [{
					type: "text",
					text: value.message
				}]
			},
			async execute(args) {
				const id = String(args.id);
				const config = configFromArgs(args);
				deps.updateServer(id, config);
				return {
					ok: true,
					id,
					message: `mcp_server_update: replaced config for "${id}" (serverName=${config.serverName}) — mcp-client hot-swapping.`
				};
			}
		}),
		defineTool({
			name: "mcp_server_remove",
			description: "Remove an MCP server. Deletes its insert row from the profile cordis.patch.yml; the mcp-client instance disposes and its tools (mcp__<serverName>__*) unregister via config HMR.",
			parameters: { id: {
				type: "string",
				required: true,
				description: "The server insert-row id to remove."
			} },
			output: {
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						ok: {
							type: "boolean",
							required: true
						},
						id: {
							type: "string",
							required: true
						},
						message: {
							type: "string",
							required: true
						}
					}
				},
				render: (_args, value) => [{
					type: "text",
					text: value.message
				}]
			},
			async execute(args) {
				const id = String(args.id);
				if (!deps.deleteServer(id)) throw new Error(`mcp_server_remove: "${id}" is not a registered MCP server`);
				return {
					ok: true,
					id,
					message: `mcp_server_remove: removed "${id}" — mcp-client disposing, tools unregistering.`
				};
			}
		})
	];
}
//#endregion
//#region src/index.ts
/** Cordis 插件名。 */
const name = "dsh-mcp-manager";
/** 需要宿主 web server（web 组合）+ tools（注册 mcp_* 工具 + 读 schemas 浏览）。 */
const inject = ["webServer", "tools"];
/** 读请求体（POST/PUT）。 */
function readBody(req) {
	return new Promise((resolve) => {
		let body = "";
		const r = req;
		r.on?.("data", (c) => {
			body += c.toString("utf8");
		});
		r.on?.("end", () => resolve(body));
	});
}
/**
* 「连接中」宽限窗（毫秒）。addServer/updateServer 写入 insert 行后，mcp-client
* 经配置 HMR 挂载 → spawn 子进程/握手 → 同步工具，期间工具数=0。在该窗内
* 0 工具判为「连接中」而非「未连接」，避免面板长时间卡在误导性的「未连接」。
* 窗口过后仍 0 工具才判为「未连接/失败」（重连预算内或已耗尽）。
*
* 30s 覆盖典型首次连接 + 若干次指数退避（500ms→1s→2s→4s→8s→16s）。
* mcp-client 的连接状态封装在 startConnection 闭包内，外部无直接信号——
* 这是 P0 朴素推断（对齐开发计划 §4），非真实连接状态。
*/
const CONNECTING_GRACE_MS = 3e4;
/** 计算一个服务器的三态状态。 */
function computeStatus(toolCount, serverName, connectingSince) {
	if (toolCount > 0) return "connected";
	const since = connectingSince.get(serverName);
	if (since !== void 0 && Date.now() - since < CONNECTING_GRACE_MS) return "connecting";
	return "disconnected";
}
/** 注册控制台路由 + agent 工具。 */
function apply(ctx) {
	ctx.effect(() => {
		const loadOverlayPatches = resolveLoadOverlayPatches();
		/**
		* 各 serverName 最近一次「写配置」的时间戳（add/update）。用于推断「连接中」
		* 中间状态——mcp-client 经 HMR 挂载到工具注册有延迟。进程内存：web 重启
		* 后丢失，此时退化为「未连接」直到工具真正出现（可接受，重启少见）。
		*/
		const connectingSince = /* @__PURE__ */ new Map();
		/** 记录一次配置写入，标记该 serverName 进入「连接中」宽限窗。 */
		const markConnecting = (serverName) => {
			connectingSince.set(serverName, Date.now());
		};
		const mcpTools = createMcpTools({
			listServers,
			addServer: (config, opts) => {
				const id = addServer(config, {
					...opts,
					loadOverlayPatches
				});
				markConnecting(config.serverName);
				return id;
			},
			updateServer: (id, config) => {
				updateServer(id, config, { loadOverlayPatches });
				markConnecting(config.serverName);
			},
			deleteServer: (id) => deleteServer(id, { loadOverlayPatches }),
			registeredToolNames: () => (ctx.tools?.schemas() ?? []).map((s) => s.name),
			connectingSince,
			selfId: "@huanlin/dsh-plugin-mcp-manager"
		});
		const disposeTools = ctx.tools?.register !== void 0 ? mcpTools.map((tool) => ctx.tools.register(tool)) : [];
		if (disposeTools.length > 0) console.log(`[dsh-mcp-manager] registered mcp tools: ${mcpTools.map((t) => t.name).join(", ")}`);
		const webServer = ctx.webServer;
		if (webServer === void 0) return () => {
			for (const dispose of disposeTools) dispose();
		};
		const disposeRoutes = webServer.register({
			kind: "prefix",
			path: "/api/mcp-manager",
			handler: async (req, res) => {
				const json = (status, body) => {
					res.statusCode = status;
					res.setHeader("content-type", "application/json");
					res.end(JSON.stringify(body));
				};
				const url = req?.url ?? "/";
				const method = req?.method ?? "GET";
				const path = url.split("?")[0] ?? "/";
				const jsonRes = (status, body) => json(status, body);
				try {
					if (method === "GET" && (path === "/api/mcp-manager/servers" || path === "/api/mcp-manager/servers/")) {
						const toolNames = (ctx.tools?.schemas() ?? []).map((s) => s.name);
						jsonRes(200, {
							ok: true,
							servers: listServers().map((row) => {
								const prefix = `mcp__${row.config.serverName}__`;
								const toolCount = toolNames.filter((n) => n.startsWith(prefix)).length;
								return {
									id: row.id,
									serverName: row.config.serverName,
									transport: row.config.transport,
									endpoint: row.config.transport === "stdio" ? `${row.config.command ?? ""} ${(row.config.args ?? []).join(" ")}`.trim() : row.config.url ?? "",
									toolCount,
									status: computeStatus(toolCount, row.config.serverName, connectingSince),
									config: row.config
								};
							})
						});
						return;
					}
					if (method === "GET" && (path === "/api/mcp-manager/tools" || path === "/api/mcp-manager/tools/")) {
						const mcpToolsList = (ctx.tools?.schemas() ?? []).filter((s) => s.name.startsWith("mcp__")).map((s) => {
							const parts = s.name.split("__");
							const serverName = parts[1] ?? "";
							const rawName = parts.slice(2).join("__");
							return {
								name: s.name,
								serverName,
								rawName,
								description: s.description
							};
						});
						const groups = {};
						for (const t of mcpToolsList) {
							const arr = groups[t.serverName] ?? [];
							arr.push({
								name: t.name,
								rawName: t.rawName,
								description: t.description
							});
							groups[t.serverName] = arr;
						}
						jsonRes(200, {
							ok: true,
							groups
						});
						return;
					}
					if (method === "GET" && (path === "/api/mcp-manager/status" || path === "/api/mcp-manager/status/")) {
						const toolNames = (ctx.tools?.schemas() ?? []).map((s) => s.name);
						jsonRes(200, {
							ok: true,
							status: listServers().map((row) => {
								const prefix = `mcp__${row.config.serverName}__`;
								const toolCount = toolNames.filter((n) => n.startsWith(prefix)).length;
								return {
									id: row.id,
									serverName: row.config.serverName,
									toolCount,
									status: computeStatus(toolCount, row.config.serverName, connectingSince)
								};
							})
						});
						return;
					}
					if (method === "POST" && (path === "/api/mcp-manager/servers" || path === "/api/mcp-manager/servers/")) {
						const body = await readBody(req);
						const parsed = JSON.parse(body);
						if (parsed.config === void 0) {
							jsonRes(400, {
								ok: false,
								message: "config is required"
							});
							return;
						}
						const id = addServer(parsed.config, {
							id: parsed.id,
							loadOverlayPatches
						});
						markConnecting(parsed.config.serverName);
						jsonRes(200, {
							ok: true,
							id,
							live: true,
							message: `server ${id} mounted via config HMR`
						});
						return;
					}
					const putMatch = /^\/api\/mcp-manager\/servers\/([^/]+)$/.exec(path);
					if (method === "PUT" && putMatch !== null) {
						const id = decodeURIComponent(putMatch[1]);
						const body = await readBody(req);
						const parsed = JSON.parse(body);
						if (parsed.config === void 0) {
							jsonRes(400, {
								ok: false,
								message: "config is required"
							});
							return;
						}
						updateServer(id, parsed.config, { loadOverlayPatches });
						markConnecting(parsed.config.serverName);
						jsonRes(200, {
							ok: true,
							id,
							live: true,
							message: `server ${id} config replaced (HMR hot-swap)`
						});
						return;
					}
					if (method === "DELETE" && putMatch !== null) {
						const id = decodeURIComponent(putMatch[1]);
						if (!deleteServer(id, { loadOverlayPatches })) {
							jsonRes(404, {
								ok: false,
								message: `server "${id}" not found`
							});
							return;
						}
						jsonRes(200, {
							ok: true,
							id,
							message: `server ${id} removed (tools unregistering)`
						});
						return;
					}
					jsonRes(404, {
						ok: false,
						message: "not found"
					});
				} catch (error) {
					if (error instanceof RegistryError) jsonRes(400, {
						ok: false,
						field: error.field,
						message: error.message
					});
					else jsonRes(500, {
						ok: false,
						message: error instanceof Error ? error.message : String(error)
					});
				}
			}
		});
		return () => {
			for (const dispose of disposeTools) dispose();
			disposeRoutes();
		};
	}, "dsh-mcp-manager: config read/write route + mcp tools");
}
//#endregion
export { apply, inject, name };
