window.__ModuleLoader__.load({
	id: "@huanlin/dsh-plugin-mcp-manager",
	factory: (require) => {
		var exports = { exports: {} }.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/locales.ts
		/** Locale namespace id (matches the package basename; DSH locale namespace convention). */
		const NS = "dsh-plugin-mcp-manager";
		/** English dictionary. */
		const en = {
			heading: "MCP Servers",
			introBefore: "Manage MCP server connections. Each server is mounted by the official",
			introMid: "and tools are registered under",
			introAfter: "Config writes to the profile patch and applies live via HMR.",
			envWarning: "⚠ env / headers are stored as plaintext in the profile cordis.patch.yml (same shape as the official examples). Do not put long-lived secrets here. Disabling a server keeps its config; the loader skips mounting and tools stay unregistered (invisible to the model).",
			loading: "Loading…",
			empty: "No MCP servers yet. Click \"Add server\" to create one.",
			addServer: "+ Add server",
			addTitle: "Add server",
			transport: "Transport",
			serverNameLabel: "serverName (tool namespace, must be unique)",
			serverNamePlaceholder: "github",
			commandLabel: "command",
			commandPlaceholder: "npx",
			argsLabel: "args (one per line)",
			argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
			envLabel: "env (one key=value per line, stored as plaintext)",
			envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
			cwdLabel: "cwd (optional)",
			urlLabel: "url",
			urlPlaceholder: "https://mcp.example.com/mcp",
			headersLabel: "headers (one key=value per line, stored as plaintext)",
			headersPlaceholder: "Authorization=Bearer xxx",
			timeoutLabel: "toolCallTimeoutMs",
			cancel: "Cancel",
			save: "Save",
			add: "Add",
			edit: "Edit",
			enable: "Enable",
			disable: "Disable",
			delete: "Delete",
			tools: "Tools",
			collapse: "Collapse",
			noTools: "(no registered tools — server not connected or not synced)",
			statusDisabled: "Disabled",
			statusConnecting: "Connecting…",
			statusDisconnected: "Not connected",
			toolCount: "{count} tools"
		};
		/** Chinese dictionary. */
		const zh = {
			heading: "MCP 服务器",
			introBefore: "管理 MCP 服务器连接。每台服务器由官方",
			introMid: "挂载，工具以",
			introAfter: "命名注册。配置写入 profile patch，HMR 实时生效。",
			envWarning: "⚠ env / headers 以明文存入 profile cordis.patch.yml（与官方示例同形态）。勿放长期密钥。禁用服务器不会删除配置，loader 跳过挂载，工具不注册（模型不可见）。",
			loading: "加载中…",
			empty: "尚无 MCP 服务器。点击「新增」添加。",
			addServer: "+ 新增服务器",
			addTitle: "新增服务器",
			transport: "传输方式",
			serverNameLabel: "serverName（工具命名空间，唯一）",
			serverNamePlaceholder: "github",
			commandLabel: "command",
			commandPlaceholder: "npx",
			argsLabel: "args（每行一个）",
			argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
			envLabel: "env（每行 key=value，明文存储）",
			envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
			cwdLabel: "cwd（可空）",
			urlLabel: "url",
			urlPlaceholder: "https://mcp.example.com/mcp",
			headersLabel: "headers（每行 key=value，明文存储）",
			headersPlaceholder: "Authorization=Bearer xxx",
			timeoutLabel: "toolCallTimeoutMs",
			cancel: "取消",
			save: "保存",
			add: "添加",
			edit: "编辑",
			enable: "启用",
			disable: "禁用",
			delete: "删除",
			tools: "工具",
			collapse: "收起",
			noTools: "（无已注册工具——服务器未连接或未同步）",
			statusDisabled: "已禁用",
			statusConnecting: "连接中…",
			statusDisconnected: "未连接",
			toolCount: "{count} 工具"
		};
		/**
		* Build a translate function over one bundled dictionary. Interpolates
		* `{name}` params so a missing param leaves the placeholder in place.
		* @param dict - the dictionary to read from.
		* @returns a keyed translate function.
		*/
		function makeT(dict) {
			return (key, params) => {
				const template = dict[key];
				if (params === void 0) return template;
				return template.replace(/\{(\w+)\}/g, (match, name) => params[name] === void 0 ? match : String(params[name]));
			};
		}
		//#endregion
		//#region src/client/Panel.tsx
		/**
		* MCP 管理面板（UI 对齐官方「模型」设置页设计语言）：
		* - 服务器列表：serverName + 传输标识 + 端点摘要 + 状态 Pill（connected/
		*   disconnected/disabled）+ 工具数；行内操作：编辑 / 禁用|启用 / 删除
		* - 新增/编辑表单：transport 切换（stdio ↔ streamable-http 字段组联动）；
		*   serverName/command/args/env/url/headers/超时；**内联渲染**——编辑既有
		*   服务器时表单展开在对应卡片下方，新增时作为顶部独立卡片
		* - 工具浏览：点击服务器展开其 mcp__ 工具列表（名称 + 描述），只读
		* - 禁用：entry-level `disabled: true` 字段（config 保留，loader 跳过挂载，
		*   工具不注册→模型不可见），与删除语义分离
		* 全部 token 走 --dsw-alias-*；零 CSS 依赖（inline 样式）。
		*
		* 文案走 DSH locale（`dsh-plugin-mcp-manager` 命名空间）：slot 渲染器绑定
		* 语言座位 `t`（跟随 DSH zh/en，better-locale 覆盖生效时优先覆盖文本）；
		* `makeT(zh)` 是 slot 系统外的直挂回退（测试/快速挂载）。
		*/
		const sectionStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 12,
			maxWidth: 720,
			color: "var(--dsw-alias-label-primary)"
		};
		const titleStyle = {
			margin: 0,
			fontSize: 16,
			lineHeight: "24px",
			fontWeight: 500,
			color: "var(--dsw-alias-label-primary)"
		};
		const introStyle = {
			margin: 0,
			fontSize: 14,
			lineHeight: "22px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const rowsStyle = {
			margin: "12px 0 0",
			padding: 0,
			display: "flex",
			flexDirection: "column",
			gap: 8
		};
		const rowCardStyle = {
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 12,
			padding: "12px 14px",
			display: "flex",
			flexDirection: "column",
			gap: 10
		};
		const rowHeadStyle = {
			display: "flex",
			alignItems: "center",
			gap: 10,
			minHeight: 28
		};
		const identityStyle = {
			display: "inline-flex",
			alignItems: "center",
			gap: 6,
			minWidth: 0,
			flex: 1
		};
		const nameStyle = {
			fontSize: 14,
			lineHeight: "22px",
			fontWeight: 500,
			color: "var(--dsw-alias-label-primary)"
		};
		const metaStyle = {
			fontSize: 11,
			lineHeight: "16px",
			color: "var(--dsw-alias-label-tertiary)",
			fontFamily: "ui-monospace, monospace"
		};
		const actionsStyle = {
			display: "inline-flex",
			alignItems: "center",
			gap: 4,
			marginLeft: "auto"
		};
		const editorStyle = {
			borderRadius: 12,
			background: "var(--dsw-alias-bg-module-platform)",
			padding: "14px 16px",
			display: "flex",
			flexDirection: "column",
			gap: 14
		};
		const fieldStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 6
		};
		const fieldLabelStyle = {
			fontSize: 12,
			lineHeight: "18px",
			fontWeight: 500,
			color: "var(--dsw-alias-label-secondary)"
		};
		const editorActionsStyle = {
			display: "flex",
			justifyContent: "flex-end",
			gap: 8
		};
		const errorStyle = {
			margin: 0,
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-state-error-primary)"
		};
		const toolListStyle = {
			margin: "6px 0 0",
			padding: "8px 12px",
			display: "flex",
			flexDirection: "column",
			gap: 4,
			background: "var(--dsw-alias-bg-module-platform)",
			borderRadius: 8
		};
		const toolRowStyle = {
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-secondary)"
		};
		const toolNameStyle = {
			fontFamily: "ui-monospace, monospace",
			color: "var(--dsw-alias-label-primary)"
		};
		const warnStyle = {
			margin: "8px 0 0",
			fontSize: 11,
			lineHeight: "16px",
			color: "var(--dsw-alias-state-warning-primary)"
		};
		/** 空表单默认值。 */
		function emptyForm(transport = "stdio") {
			return transport === "stdio" ? {
				serverName: "",
				transport: "stdio",
				command: "",
				args: [],
				env: {},
				cwd: "",
				toolCallTimeoutMs: 6e4,
				failOnStartupError: false
			} : {
				serverName: "",
				transport: "streamable-http",
				url: "",
				headers: {},
				toolCallTimeoutMs: 6e4,
				failOnStartupError: false
			};
		}
		/** 把键值对 Record 渲染为可编辑文本（每行 key=value）。 */
		function recordToText(r) {
			if (r === void 0) return "";
			return Object.entries(r).map(([k, v]) => `${k}=${v}`).join("\n");
		}
		/** 把文本（每行 key=value）解析回 Record。 */
		function textToRecord(text) {
			const out = {};
			for (const line of text.split("\n")) {
				const trimmed = line.trim();
				if (trimmed.length === 0) continue;
				const eq = trimmed.indexOf("=");
				if (eq === -1) {
					out[trimmed] = "";
					continue;
				}
				out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
			}
			return out;
		}
		function ServerEditor(props) {
			const { config: c, isEdit, busy, envText, headersText, t } = props;
			const isStdio = c.transport === "stdio";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: editorStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: fieldStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							style: fieldLabelStyle,
							children: t("transport")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								gap: 8
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								onClick: () => props.onSwitchTransport("stdio"),
								disabled: busy,
								children: isStdio ? "✓ stdio" : "stdio"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								onClick: () => props.onSwitchTransport("streamable-http"),
								disabled: busy,
								children: !isStdio ? "✓ streamable-http" : "streamable-http"
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: fieldStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							style: fieldLabelStyle,
							children: t("serverNameLabel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
							value: c.serverName,
							onChange: (e) => props.onConfigChange({
								...c,
								serverName: e.target.value
							}),
							disabled: busy,
							placeholder: t("serverNamePlaceholder")
						})]
					}),
					isStdio ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: fieldStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								style: fieldLabelStyle,
								children: t("commandLabel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
								value: c.command ?? "",
								onChange: (e) => props.onConfigChange({
									...c,
									command: e.target.value
								}),
								disabled: busy,
								placeholder: t("commandPlaceholder")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: fieldStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								style: fieldLabelStyle,
								children: t("argsLabel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								value: (c.args ?? []).join("\n"),
								onChange: (e) => props.onConfigChange({
									...c,
									args: e.target.value.split("\n")
								}),
								disabled: busy,
								rows: 3,
								style: {
									fontSize: 12,
									fontFamily: "ui-monospace, monospace",
									borderRadius: 8,
									border: "1px solid var(--dsw-alias-border-l2)",
									padding: "8px 10px"
								},
								placeholder: t("argsPlaceholder")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: fieldStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								style: fieldLabelStyle,
								children: t("envLabel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								value: envText,
								onChange: (e) => props.onEnvTextChange(e.target.value),
								disabled: busy,
								rows: 3,
								style: {
									fontSize: 12,
									fontFamily: "ui-monospace, monospace",
									borderRadius: 8,
									border: "1px solid var(--dsw-alias-border-l2)",
									padding: "8px 10px"
								},
								placeholder: t("envPlaceholder")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: fieldStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								style: fieldLabelStyle,
								children: t("cwdLabel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
								value: c.cwd ?? "",
								onChange: (e) => props.onConfigChange({
									...c,
									cwd: e.target.value
								}),
								disabled: busy,
								placeholder: ""
							})]
						})
					] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: fieldStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							style: fieldLabelStyle,
							children: t("urlLabel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
							value: c.url ?? "",
							onChange: (e) => props.onConfigChange({
								...c,
								url: e.target.value
							}),
							disabled: busy,
							placeholder: t("urlPlaceholder")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: fieldStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							style: fieldLabelStyle,
							children: t("headersLabel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
							value: headersText,
							onChange: (e) => props.onHeadersTextChange(e.target.value),
							disabled: busy,
							rows: 3,
							style: {
								fontSize: 12,
								fontFamily: "ui-monospace, monospace",
								borderRadius: 8,
								border: "1px solid var(--dsw-alias-border-l2)",
								padding: "8px 10px"
							},
							placeholder: t("headersPlaceholder")
						})]
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: fieldStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							style: fieldLabelStyle,
							children: t("timeoutLabel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
							type: "number",
							value: String(c.toolCallTimeoutMs ?? 6e4),
							onChange: (e) => props.onConfigChange({
								...c,
								toolCallTimeoutMs: Number(e.target.value) || 6e4
							}),
							disabled: busy
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: editorActionsStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							onClick: props.onCancel,
							disabled: busy,
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							onClick: props.onSave,
							disabled: busy,
							children: isEdit ? t("save") : t("add")
						})]
					})
				]
			});
		}
		/**
		* 设置页面板主体。`t` 是 slot 系统绑定 locale 座位后的翻译函数（跟随 DSH
		* zh/en + better-locale 覆盖）；缺省回退到 zh 字典，供 slot 外直挂使用。
		*/
		function McpPanel({ t = makeT(zh) }) {
			const [servers, setServers] = (0, react.useState)([]);
			const [toolGroups, setToolGroups] = (0, react.useState)({});
			const [error, setError] = (0, react.useState)(void 0);
			const [loading, setLoading] = (0, react.useState)(true);
			const [busy, setBusy] = (0, react.useState)(false);
			const [expanded, setExpanded] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [editing, setEditing] = (0, react.useState)(void 0);
			const [envText, setEnvText] = (0, react.useState)("");
			const [headersText, setHeadersText] = (0, react.useState)("");
			const refresh = (0, react.useCallback)(async () => {
				try {
					const [serversRes, toolsRes] = await Promise.all([fetch("/api/mcp-manager/servers", { headers: { accept: "application/json" } }), fetch("/api/mcp-manager/tools", { headers: { accept: "application/json" } })]);
					const serversBody = await serversRes.json();
					const toolsBody = await toolsRes.json();
					setServers(serversBody.servers ?? []);
					setToolGroups(toolsBody.groups ?? {});
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : String(caught));
				} finally {
					setLoading(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			/**
			* 自动轮询：存在「连接中」服务器时每 2s 刷新一次（mcp-client 挂载/握手有延迟，
			* 工具注册后状态会变为 connected）；全部稳定后停止轮询。避免面板长时间卡在
			* 误导性的「未连接」——连接中显示「连接中…」并自动追上到「已连接」。
			*/
			(0, react.useEffect)(() => {
				if (!servers.some((s) => s.status === "connecting")) return;
				const timer = setInterval(() => {
					refresh();
				}, 2e3);
				return () => clearInterval(timer);
			}, [servers, refresh]);
			/** 打开新增表单。 */
			const startAdd = (0, react.useCallback)(() => {
				const config = emptyForm("stdio");
				setEditing({
					id: "",
					config
				});
				setEnvText("");
				setHeadersText("");
				setError(void 0);
			}, []);
			/** 打开编辑表单（内联到对应卡片下方）。 */
			const startEdit = (0, react.useCallback)((row) => {
				setEditing({
					id: row.id,
					config: { ...row.config }
				});
				setEnvText(recordToText(row.config.env));
				setHeadersText(recordToText(row.config.headers));
				setError(void 0);
			}, []);
			/** 切换 transport（重置字段组）。 */
			const switchTransport = (0, react.useCallback)((transport) => {
				setEditing((prev) => prev === void 0 ? prev : {
					...prev,
					config: emptyForm(transport)
				});
				setEnvText("");
				setHeadersText("");
			}, []);
			/** 保存（新增或更新）。 */
			const save = (0, react.useCallback)(async () => {
				if (editing === void 0) return;
				setBusy(true);
				setError(void 0);
				try {
					const config = { ...editing.config };
					if (config.transport === "stdio") config.env = textToRecord(envText);
					else config.headers = textToRecord(headersText);
					const isEdit = editing.id.length > 0;
					const body = await (await fetch(isEdit ? `/api/mcp-manager/servers/${encodeURIComponent(editing.id)}` : "/api/mcp-manager/servers", {
						method: isEdit ? "PUT" : "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(isEdit ? { config } : { config })
					})).json();
					if (body.ok !== true) throw new Error(body.message ?? "save failed");
					setEditing(void 0);
					await refresh();
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : String(caught));
				} finally {
					setBusy(false);
				}
			}, [
				editing,
				envText,
				headersText,
				refresh
			]);
			/** 删除。 */
			const remove = (0, react.useCallback)(async (id) => {
				setBusy(true);
				setError(void 0);
				try {
					const body = await (await fetch(`/api/mcp-manager/servers/${encodeURIComponent(id)}`, { method: "DELETE" })).json();
					if (body.ok !== true) throw new Error(body.message ?? "delete failed");
					if (editing?.id === id) setEditing(void 0);
					await refresh();
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : String(caught));
				} finally {
					setBusy(false);
				}
			}, [refresh, editing]);
			/** 禁用/启用（不删除配置）。 */
			const toggleDisabled = (0, react.useCallback)(async (row) => {
				setBusy(true);
				setError(void 0);
				try {
					const body = await (await fetch(`/api/mcp-manager/servers/${encodeURIComponent(row.id)}`, {
						method: "PATCH",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ disabled: !row.disabled })
					})).json();
					if (body.ok !== true) throw new Error(body.message ?? "toggle failed");
					await refresh();
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : String(caught));
				} finally {
					setBusy(false);
				}
			}, [refresh]);
			/** 展开/折叠工具浏览。 */
			const toggleExpand = (0, react.useCallback)((id) => {
				setExpanded((prev) => {
					const next = new Set(prev);
					if (next.has(id)) next.delete(id);
					else next.add(id);
					return next;
				});
			}, []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				style: sectionStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						style: titleStyle,
						children: t("heading")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						style: introStyle,
						children: [
							t("introBefore"),
							" ",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: "@deepseek-ai/dsh-mcp-client" }),
							" ",
							t("introMid"),
							" ",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: "mcp__<serverName>__*" }),
							" ",
							t("introAfter")
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: warnStyle,
						children: t("envWarning")
					}),
					error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: errorStyle,
						children: error
					}),
					loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: introStyle,
						children: t("loading")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: rowsStyle,
						children: [
							editing !== void 0 && editing.id.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: rowCardStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: rowHeadStyle,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: identityStyle,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: nameStyle,
											children: t("addTitle")
										})
									})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ServerEditor, {
									config: editing.config,
									isEdit: false,
									busy,
									envText,
									headersText,
									t,
									onConfigChange: (next) => setEditing((prev) => prev === void 0 ? prev : {
										...prev,
										config: next
									}),
									onEnvTextChange: setEnvText,
									onHeadersTextChange: setHeadersText,
									onSwitchTransport: switchTransport,
									onSave: () => void save(),
									onCancel: () => setEditing(void 0)
								})]
							}),
							servers.map((row) => {
								const isEditingThis = editing?.id === row.id;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										...rowCardStyle,
										opacity: row.disabled ? .6 : 1
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											style: rowHeadStyle,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												style: identityStyle,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: nameStyle,
													children: row.config.serverName
												}), row.disabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, { children: t("statusDisabled") }) : row.status === "connected" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
													active: true,
													children: t("toolCount", { count: row.toolCount })
												}) : row.status === "connecting" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, { children: t("statusConnecting") }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, { children: t("statusDisconnected") })]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												style: actionsStyle,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
														onClick: () => toggleExpand(row.id),
														disabled: busy || row.disabled,
														children: expanded.has(row.id) ? t("collapse") : t("tools")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
														onClick: () => startEdit(row),
														disabled: busy || isEditingThis,
														children: t("edit")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
														onClick: () => void toggleDisabled(row),
														disabled: busy || isEditingThis,
														children: row.disabled ? t("enable") : t("disable")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
														onClick: () => void remove(row.id),
														disabled: busy || isEditingThis,
														children: t("delete")
													})
												]
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											style: metaStyle,
											children: [
												row.transport,
												" · ",
												row.endpoint,
												" · id: ",
												row.id
											]
										}),
										expanded.has(row.id) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											style: toolListStyle,
											children: (toolGroups[row.config.serverName] ?? []).length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: toolRowStyle,
												children: t("noTools")
											}) : toolGroups[row.config.serverName].map((tool) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: toolRowStyle,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: toolNameStyle,
													children: tool.rawName
												}), tool.description !== void 0 && tool.description.length > 0 ? ` — ${tool.description}` : ""]
											}, tool.name))
										}),
										isEditingThis && editing !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ServerEditor, {
											config: editing.config,
											isEdit: true,
											busy,
											envText,
											headersText,
											t,
											onConfigChange: (next) => setEditing((prev) => prev === void 0 ? prev : {
												...prev,
												config: next
											}),
											onEnvTextChange: setEnvText,
											onHeadersTextChange: setHeadersText,
											onSwitchTransport: switchTransport,
											onSave: () => void save(),
											onCancel: () => setEditing(void 0)
										})
									]
								}, row.id);
							}),
							servers.length === 0 && editing === void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: introStyle,
								children: t("empty")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: editorActionsStyle,
						children: editing === void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							onClick: startAdd,
							disabled: busy,
							children: t("addServer")
						})
					})
				]
			});
		}
		//#endregion
		//#region src/client/dictionaries.ts
		/** All override-language dictionaries for the `NS` namespace. */
		const dicts = {
			ja: {
				heading: "MCP サーバー",
				introBefore: "MCP サーバー接続を管理します。各サーバーは公式の",
				introMid: "によってマウントされ、ツールは",
				introAfter: "として登録されます。設定は profile patch に書き込まれ、HMR で即時反映されます。",
				envWarning: "⚠ env / headers は profile cordis.patch.yml に平文で保存されます（公式サンプルと同じ形式）。長期の秘密鍵は置かないでください。サーバーを無効化しても設定は削除されず、loader がマウントをスキップしてツールは登録されません（モデルから見えなくなります）。",
				loading: "読み込み中…",
				empty: "MCP サーバーはまだありません。「サーバーを追加」で作成してください。",
				addServer: "+ サーバーを追加",
				addTitle: "サーバーを追加",
				transport: "転送方式",
				serverNameLabel: "serverName（ツール名前空間、一意である必要があります）",
				serverNamePlaceholder: "github",
				commandLabel: "command",
				commandPlaceholder: "npx",
				argsLabel: "args（1 行に 1 つ）",
				argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
				envLabel: "env（1 行に 1 つの key=value、平文で保存）",
				envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
				cwdLabel: "cwd（省略可）",
				urlLabel: "url",
				urlPlaceholder: "https://mcp.example.com/mcp",
				headersLabel: "headers（1 行に 1 つの key=value、平文で保存）",
				headersPlaceholder: "Authorization=Bearer xxx",
				timeoutLabel: "toolCallTimeoutMs",
				cancel: "キャンセル",
				save: "保存",
				add: "追加",
				edit: "編集",
				enable: "有効化",
				disable: "無効化",
				delete: "削除",
				tools: "ツール",
				collapse: "折りたたむ",
				noTools: "（登録済みツールなし——サーバーが未接続または未同期です）",
				statusDisabled: "無効",
				statusConnecting: "接続中…",
				statusDisconnected: "未接続",
				toolCount: "{count} ツール"
			},
			de: {
				heading: "MCP-Server",
				introBefore: "MCP-Serververbindungen verwalten. Jeder Server wird von der offiziellen",
				introMid: "gemountet, wobei Tools unter",
				introAfter: "registriert werden. Die Konfiguration wird in den Profile-Patch geschrieben und per HMR sofort wirksam.",
				envWarning: "⚠ env / headers werden im Profile cordis.patch.yml im Klartext gespeichert (wie in den offiziellen Beispielen). Keine langlebigen Geheimnisse hier ablegen. Das Deaktivieren eines Servers löscht die Konfiguration nicht; der Loader überspringt das Mounten und Tools bleiben unregistriert (für das Modell unsichtbar).",
				loading: "Wird geladen…",
				empty: "Noch keine MCP-Server. Klicke auf „Server hinzufügen”, um einen anzulegen.",
				addServer: "+ Server hinzufügen",
				addTitle: "Server hinzufügen",
				transport: "Transport",
				serverNameLabel: "serverName (Tool-Namespace, muss eindeutig sein)",
				serverNamePlaceholder: "github",
				commandLabel: "command",
				commandPlaceholder: "npx",
				argsLabel: "args (eines pro Zeile)",
				argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
				envLabel: "env (ein key=value pro Zeile, im Klartext gespeichert)",
				envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
				cwdLabel: "cwd (optional)",
				urlLabel: "url",
				urlPlaceholder: "https://mcp.example.com/mcp",
				headersLabel: "headers (ein key=value pro Zeile, im Klartext gespeichert)",
				headersPlaceholder: "Authorization=Bearer xxx",
				timeoutLabel: "toolCallTimeoutMs",
				cancel: "Abbrechen",
				save: "Speichern",
				add: "Hinzufügen",
				edit: "Bearbeiten",
				enable: "Aktivieren",
				disable: "Deaktivieren",
				delete: "Löschen",
				tools: "Tools",
				collapse: "Einklappen",
				noTools: "(keine registrierten Tools — Server nicht verbunden oder nicht synchronisiert)",
				statusDisabled: "Deaktiviert",
				statusConnecting: "Verbinde…",
				statusDisconnected: "Nicht verbunden",
				toolCount: "{count} Tools"
			},
			fr: {
				heading: "Serveurs MCP",
				introBefore: "Gérez les connexions aux serveurs MCP. Chaque serveur est monté par le",
				introMid: "officiel, et les outils sont enregistrés sous",
				introAfter: "La configuration est écrite dans le patch du profil et appliquée en direct via HMR.",
				envWarning: "⚠ env / headers sont stockés en clair dans le cordis.patch.yml du profil (comme les exemples officiels). N'y placez pas de secrets durables. Désactiver un serveur conserve sa configuration ; le loader ignore le montage et les outils restent non enregistrés (invisibles pour le modèle).",
				loading: "Chargement…",
				empty: "Aucun serveur MCP pour le moment. Cliquez sur « Ajouter un serveur » pour en créer un.",
				addServer: "+ Ajouter un serveur",
				addTitle: "Ajouter un serveur",
				transport: "Transport",
				serverNameLabel: "serverName (espace de noms des outils, doit être unique)",
				serverNamePlaceholder: "github",
				commandLabel: "command",
				commandPlaceholder: "npx",
				argsLabel: "args (un par ligne)",
				argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
				envLabel: "env (un key=value par ligne, stocké en clair)",
				envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
				cwdLabel: "cwd (optionnel)",
				urlLabel: "url",
				urlPlaceholder: "https://mcp.example.com/mcp",
				headersLabel: "headers (un key=value par ligne, stocké en clair)",
				headersPlaceholder: "Authorization=Bearer xxx",
				timeoutLabel: "toolCallTimeoutMs",
				cancel: "Annuler",
				save: "Enregistrer",
				add: "Ajouter",
				edit: "Modifier",
				enable: "Activer",
				disable: "Désactiver",
				delete: "Supprimer",
				tools: "Outils",
				collapse: "Réduire",
				noTools: "(aucun outil enregistré — serveur non connecté ou non synchronisé)",
				statusDisabled: "Désactivé",
				statusConnecting: "Connexion…",
				statusDisconnected: "Non connecté",
				toolCount: "{count} outils"
			},
			pt: {
				heading: "Servidores MCP",
				introBefore: "Gerencie as conexões dos servidores MCP. Cada servidor é montado pelo",
				introMid: "oficial, e as ferramentas são registradas sob",
				introAfter: "A configuração é gravada no patch do perfil e aplicada ao vivo via HMR.",
				envWarning: "⚠ env / headers são armazenados em texto puro no cordis.patch.yml do perfil (mesmo formato dos exemplos oficiais). Não coloque segredos de longo prazo aqui. Desativar um servidor mantém a configuração; o loader pula a montagem e as ferramentas permanecem não registradas (invisíveis para o modelo).",
				loading: "Carregando…",
				empty: "Ainda não há servidores MCP. Clique em \"Adicionar servidor\" para criar um.",
				addServer: "+ Adicionar servidor",
				addTitle: "Adicionar servidor",
				transport: "Transporte",
				serverNameLabel: "serverName (namespace de ferramentas, deve ser único)",
				serverNamePlaceholder: "github",
				commandLabel: "command",
				commandPlaceholder: "npx",
				argsLabel: "args (um por linha)",
				argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
				envLabel: "env (um key=value por linha, armazenado em texto puro)",
				envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
				cwdLabel: "cwd (opcional)",
				urlLabel: "url",
				urlPlaceholder: "https://mcp.example.com/mcp",
				headersLabel: "headers (um key=value por linha, armazenado em texto puro)",
				headersPlaceholder: "Authorization=Bearer xxx",
				timeoutLabel: "toolCallTimeoutMs",
				cancel: "Cancelar",
				save: "Salvar",
				add: "Adicionar",
				edit: "Editar",
				enable: "Ativar",
				disable: "Desativar",
				delete: "Excluir",
				tools: "Ferramentas",
				collapse: "Recolher",
				noTools: "(nenhuma ferramenta registrada — servidor não conectado ou não sincronizado)",
				statusDisabled: "Desativado",
				statusConnecting: "Conectando…",
				statusDisconnected: "Não conectado",
				toolCount: "{count} ferramentas"
			},
			ko: {
				heading: "MCP 서버",
				introBefore: "MCP 서버 연결을 관리합니다. 각 서버는 공식",
				introMid: "에 의해 마운트되며, 도구는",
				introAfter: "로 등록됩니다. 설정은 profile patch에 기록되어 HMR로 즉시 적용됩니다.",
				envWarning: "⚠ env / headers는 profile cordis.patch.yml에 평문으로 저장됩니다(공식 예제와 동일한 형태). 장기 보관할 비밀 키는 넣지 마세요. 서버를 비활성화해도 설정은 삭제되지 않으며, loader가 마운트를 건너뛰어 도구가 등록되지 않습니다(모델에 보이지 않음).",
				loading: "불러오는 중…",
				empty: "아직 MCP 서버가 없습니다. \"서버 추가\"를 클릭하여 생성하세요.",
				addServer: "+ 서버 추가",
				addTitle: "서버 추가",
				transport: "전송 방식",
				serverNameLabel: "serverName(도구 네임스페이스, 고유해야 함)",
				serverNamePlaceholder: "github",
				commandLabel: "command",
				commandPlaceholder: "npx",
				argsLabel: "args(줄마다 하나)",
				argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
				envLabel: "env(줄마다 key=value 하나씩, 평문 저장)",
				envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
				cwdLabel: "cwd(선택)",
				urlLabel: "url",
				urlPlaceholder: "https://mcp.example.com/mcp",
				headersLabel: "headers(줄마다 key=value 하나씩, 평문 저장)",
				headersPlaceholder: "Authorization=Bearer xxx",
				timeoutLabel: "toolCallTimeoutMs",
				cancel: "취소",
				save: "저장",
				add: "추가",
				edit: "편집",
				enable: "활성화",
				disable: "비활성화",
				delete: "삭제",
				tools: "도구",
				collapse: "접기",
				noTools: "(등록된 도구 없음 — 서버가 연결되지 않았거나 동기화되지 않음)",
				statusDisabled: "비활성화됨",
				statusConnecting: "연결 중…",
				statusDisconnected: "연결 안 됨",
				toolCount: "도구 {count}개"
			},
			ar: {
				heading: "خوادم MCP",
				introBefore: "إدارة اتصالات خوادم MCP. يتم تركيب كل خادم بواسطة",
				introMid: "الرسمي، ويتم تسجيل الأدوات تحت",
				introAfter: "تُكتب الإعدادات في تصحيح ملف التعريف (profile patch) وتُطبَّق فورًا عبر HMR.",
				envWarning: "⚠ تُخزَّن env / headers كنص صريح في cordis.patch.yml لملف التعريف (بنفس شكل الأمثلة الرسمية). لا تضع أسرارًا طويلة الأمد هنا. تعطيل خادم يحتفظ بإعداداته؛ يتخطى المحمّل التركيب وتبقى الأدوات غير مسجلة (غير مرئية للنموذج).",
				loading: "جارٍ التحميل…",
				empty: "لا توجد خوادم MCP بعد. انقر فوق «إضافة خادم» لإنشاء واحد.",
				addServer: "+ إضافة خادم",
				addTitle: "إضافة خادم",
				transport: "النقل",
				serverNameLabel: "serverName (مساحة أسماء الأدوات، يجب أن يكون فريدًا)",
				serverNamePlaceholder: "github",
				commandLabel: "command",
				commandPlaceholder: "npx",
				argsLabel: "args (واحد لكل سطر)",
				argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
				envLabel: "env (key=value واحد لكل سطر، مخزَّن كنص صريح)",
				envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
				cwdLabel: "cwd (اختياري)",
				urlLabel: "url",
				urlPlaceholder: "https://mcp.example.com/mcp",
				headersLabel: "headers (key=value واحد لكل سطر، مخزَّن كنص صريح)",
				headersPlaceholder: "Authorization=Bearer xxx",
				timeoutLabel: "toolCallTimeoutMs",
				cancel: "إلغاء",
				save: "حفظ",
				add: "إضافة",
				edit: "تعديل",
				enable: "تفعيل",
				disable: "تعطيل",
				delete: "حذف",
				tools: "الأدوات",
				collapse: "طي",
				noTools: "(لا أدوات مسجلة — الخادم غير متصل أو غير متزامن)",
				statusDisabled: "معطَّل",
				statusConnecting: "جارٍ الاتصال…",
				statusDisconnected: "غير متصل",
				toolCount: "{count} أدوات"
			},
			hi: {
				heading: "MCP सर्वर",
				introBefore: "MCP सर्वर कनेक्शन प्रबंधित करें। प्रत्येक सर्वर आधिकारिक",
				introMid: "द्वारा माउंट किया जाता है, और टूल",
				introAfter: "के अंतर्गत पंजीकृत होते हैं। कॉन्फ़िग profile patch में लिखा जाता है और HMR के माध्यम से तुरंत लागू होता है।",
				envWarning: "⚠ env / headers profile cordis.patch.yml में सादे पाठ में संग्रहीत होते हैं (आधिकारिक उदाहरणों के समान रूप)। यहाँ दीर्घकालिक रहस्य न रखें। सर्वर को अक्षम करने से उसका कॉन्फ़िग बना रहता है; loader माउंटिंग छोड़ देता है और टूल पंजीकृत नहीं रहते (मॉडल को दिखाई नहीं देते)।",
				loading: "लोड हो रहा है…",
				empty: "अभी कोई MCP सर्वर नहीं है। बनाने के लिए \"सर्वर जोड़ें\" पर क्लिक करें।",
				addServer: "+ सर्वर जोड़ें",
				addTitle: "सर्वर जोड़ें",
				transport: "ट्रांसपोर्ट",
				serverNameLabel: "serverName (टूल नेमस्पेस, अद्वितीय होना चाहिए)",
				serverNamePlaceholder: "github",
				commandLabel: "command",
				commandPlaceholder: "npx",
				argsLabel: "args (प्रति पंक्ति एक)",
				argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
				envLabel: "env (प्रति पंक्ति एक key=value, सादे पाठ में संग्रहीत)",
				envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
				cwdLabel: "cwd (वैकल्पिक)",
				urlLabel: "url",
				urlPlaceholder: "https://mcp.example.com/mcp",
				headersLabel: "headers (प्रति पंक्ति एक key=value, सादे पाठ में संग्रहीत)",
				headersPlaceholder: "Authorization=Bearer xxx",
				timeoutLabel: "toolCallTimeoutMs",
				cancel: "रद्द करें",
				save: "सहेजें",
				add: "जोड़ें",
				edit: "संपादित करें",
				enable: "सक्षम करें",
				disable: "अक्षम करें",
				delete: "हटाएँ",
				tools: "टूल",
				collapse: "संक्षिप्त करें",
				noTools: "(कोई पंजीकृत टूल नहीं — सर्वर कनेक्ट नहीं है या सिंक नहीं हुआ)",
				statusDisabled: "अक्षम",
				statusConnecting: "कनेक्ट हो रहा है…",
				statusDisconnected: "कनेक्ट नहीं है",
				toolCount: "{count} टूल"
			},
			id: {
				heading: "Server MCP",
				introBefore: "Kelola koneksi server MCP. Setiap server dipasang oleh",
				introMid: "resmi, dan alat didaftarkan di bawah",
				introAfter: "Konfigurasi ditulis ke patch profil dan langsung berlaku melalui HMR.",
				envWarning: "⚠ env / headers disimpan sebagai teks biasa di cordis.patch.yml profil (sama seperti contoh resmi). Jangan taruh rahasia jangka panjang di sini. Menonaktifkan server tetap menyimpan konfigurasinya; loader melewati pemasangan dan alat tidak terdaftar (tidak terlihat oleh model).",
				loading: "Memuat…",
				empty: "Belum ada server MCP. Klik \"Tambahkan server\" untuk membuatnya.",
				addServer: "+ Tambahkan server",
				addTitle: "Tambahkan server",
				transport: "Transport",
				serverNameLabel: "serverName (namespace alat, harus unik)",
				serverNamePlaceholder: "github",
				commandLabel: "command",
				commandPlaceholder: "npx",
				argsLabel: "args (satu per baris)",
				argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
				envLabel: "env (satu key=value per baris, disimpan sebagai teks biasa)",
				envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
				cwdLabel: "cwd (opsional)",
				urlLabel: "url",
				urlPlaceholder: "https://mcp.example.com/mcp",
				headersLabel: "headers (satu key=value per baris, disimpan sebagai teks biasa)",
				headersPlaceholder: "Authorization=Bearer xxx",
				timeoutLabel: "toolCallTimeoutMs",
				cancel: "Batal",
				save: "Simpan",
				add: "Tambah",
				edit: "Edit",
				enable: "Aktifkan",
				disable: "Nonaktifkan",
				delete: "Hapus",
				tools: "Alat",
				collapse: "Ciutkan",
				noTools: "(tidak ada alat terdaftar — server tidak terhubung atau belum tersinkron)",
				statusDisabled: "Nonaktif",
				statusConnecting: "Menghubungkan…",
				statusDisconnected: "Tidak terhubung",
				toolCount: "{count} alat"
			},
			tr: {
				heading: "MCP Sunucuları",
				introBefore: "MCP sunucu bağlantılarını yönetin. Her sunucu resmi",
				introMid: "tarafından bağlanır ve araçlar",
				introAfter: "ile kaydedilir. Yapılandırma profil yamasına yazılır ve HMR ile anında uygulanır.",
				envWarning: "⚠ env / headers, profil cordis.patch.yml dosyasında düz metin olarak saklanır (resmi örneklerle aynı biçim). Buraya uzun ömürlü sırlar koymayın. Bir sunucuyu devre dışı bırakmak yapılandırmasını korur; yükleyici bağlamayı atlar ve araçlar kayıtsız kalır (model tarafından görülemez).",
				loading: "Yükleniyor…",
				empty: "Henüz MCP sunucusu yok. Oluşturmak için \"Sunucu ekle\"ye tıklayın.",
				addServer: "+ Sunucu ekle",
				addTitle: "Sunucu ekle",
				transport: "Aktarım",
				serverNameLabel: "serverName (araç ad alanı, benzersiz olmalı)",
				serverNamePlaceholder: "github",
				commandLabel: "command",
				commandPlaceholder: "npx",
				argsLabel: "args (satır başına bir)",
				argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
				envLabel: "env (satır başına bir key=value, düz metin olarak saklanır)",
				envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
				cwdLabel: "cwd (isteğe bağlı)",
				urlLabel: "url",
				urlPlaceholder: "https://mcp.example.com/mcp",
				headersLabel: "headers (satır başına bir key=value, düz metin olarak saklanır)",
				headersPlaceholder: "Authorization=Bearer xxx",
				timeoutLabel: "toolCallTimeoutMs",
				cancel: "İptal",
				save: "Kaydet",
				add: "Ekle",
				edit: "Düzenle",
				enable: "Etkinleştir",
				disable: "Devre dışı bırak",
				delete: "Sil",
				tools: "Araçlar",
				collapse: "Daralt",
				noTools: "(kayıtlı araç yok — sunucu bağlı değil veya eşitlenmemiş)",
				statusDisabled: "Devre dışı",
				statusConnecting: "Bağlanıyor…",
				statusDisconnected: "Bağlı değil",
				toolCount: "{count} araç"
			},
			vi: {
				heading: "Máy chủ MCP",
				introBefore: "Quản lý kết nối máy chủ MCP. Mỗi máy chủ được gắn bởi",
				introMid: "chính thức, và các công cụ được đăng ký dưới",
				introAfter: "Cấu hình được ghi vào profile patch và áp dụng trực tiếp qua HMR.",
				envWarning: "⚠ env / headers được lưu dưới dạng văn bản thô trong cordis.patch.yml của profile (giống các ví dụ chính thức). Không đặt bí mật dài hạn ở đây. Vô hiệu hóa máy chủ vẫn giữ cấu hình; loader bỏ qua việc gắn và các công cụ không được đăng ký (không hiển thị với mô hình).",
				loading: "Đang tải…",
				empty: "Chưa có máy chủ MCP nào. Nhấp \"Thêm máy chủ\" để tạo.",
				addServer: "+ Thêm máy chủ",
				addTitle: "Thêm máy chủ",
				transport: "Giao thức truyền",
				serverNameLabel: "serverName (không gian tên công cụ, phải là duy nhất)",
				serverNamePlaceholder: "github",
				commandLabel: "command",
				commandPlaceholder: "npx",
				argsLabel: "args (mỗi dòng một)",
				argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
				envLabel: "env (mỗi dòng một key=value, lưu dạng văn bản thô)",
				envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
				cwdLabel: "cwd (tùy chọn)",
				urlLabel: "url",
				urlPlaceholder: "https://mcp.example.com/mcp",
				headersLabel: "headers (mỗi dòng một key=value, lưu dạng văn bản thô)",
				headersPlaceholder: "Authorization=Bearer xxx",
				timeoutLabel: "toolCallTimeoutMs",
				cancel: "Hủy",
				save: "Lưu",
				add: "Thêm",
				edit: "Sửa",
				enable: "Bật",
				disable: "Tắt",
				delete: "Xóa",
				tools: "Công cụ",
				collapse: "Thu gọn",
				noTools: "(không có công cụ nào được đăng ký — máy chủ chưa kết nối hoặc chưa đồng bộ)",
				statusDisabled: "Đã tắt",
				statusConnecting: "Đang kết nối…",
				statusDisconnected: "Chưa kết nối",
				toolCount: "{count} công cụ"
			},
			th: {
				heading: "เซิร์ฟเวอร์ MCP",
				introBefore: "จัดการการเชื่อมต่อเซิร์ฟเวอร์ MCP เซิร์ฟเวอร์แต่ละตัวถูกเมานต์โดย",
				introMid: "อย่างเป็นทางการ และเครื่องมือลงทะเบียนภายใต้",
				introAfter: "การกำหนดค่าถูกเขียนลงใน profile patch และนำไปใช้ทันทีผ่าน HMR",
				envWarning: "⚠ env / headers ถูกจัดเก็บเป็นข้อความธรรมดาใน cordis.patch.yml ของโปรไฟล์ (รูปแบบเดียวกับตัวอย่างทางการ) อย่าใส่ความลับระยะยาวที่นี่ การปิดใช้งานเซิร์ฟเวอร์ยังคงเก็บการกำหนดค่าไว้ loader จะข้ามการเมานต์และเครื่องมือจะไม่ลงทะเบียน (มองไม่เห็นโดยโมเดล)",
				loading: "กำลังโหลด…",
				empty: "ยังไม่มีเซิร์ฟเวอร์ MCP คลิก \"เพิ่มเซิร์ฟเวอร์\" เพื่อสร้าง",
				addServer: "+ เพิ่มเซิร์ฟเวอร์",
				addTitle: "เพิ่มเซิร์ฟเวอร์",
				transport: "โปรโตคอลการส่ง",
				serverNameLabel: "serverName (เนมสเปซของเครื่องมือ ต้องไม่ซ้ำกัน)",
				serverNamePlaceholder: "github",
				commandLabel: "command",
				commandPlaceholder: "npx",
				argsLabel: "args (หนึ่งรายการต่อบรรทัด)",
				argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
				envLabel: "env (หนึ่ง key=value ต่อบรรทัด จัดเก็บเป็นข้อความธรรมดา)",
				envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
				cwdLabel: "cwd (ไม่บังคับ)",
				urlLabel: "url",
				urlPlaceholder: "https://mcp.example.com/mcp",
				headersLabel: "headers (หนึ่ง key=value ต่อบรรทัด จัดเก็บเป็นข้อความธรรมดา)",
				headersPlaceholder: "Authorization=Bearer xxx",
				timeoutLabel: "toolCallTimeoutMs",
				cancel: "ยกเลิก",
				save: "บันทึก",
				add: "เพิ่ม",
				edit: "แก้ไข",
				enable: "เปิดใช้งาน",
				disable: "ปิดใช้งาน",
				delete: "ลบ",
				tools: "เครื่องมือ",
				collapse: "ย่อ",
				noTools: "(ไม่มีเครื่องมือที่ลงทะเบียน — เซิร์ฟเวอร์ไม่ได้เชื่อมต่อหรือยังไม่ซิงค์)",
				statusDisabled: "ปิดใช้งาน",
				statusConnecting: "กำลังเชื่อมต่อ…",
				statusDisconnected: "ยังไม่เชื่อมต่อ",
				toolCount: "{count} เครื่องมือ"
			},
			ru: {
				heading: "Серверы MCP",
				introBefore: "Управление подключениями к серверам MCP. Каждый сервер монтируется официальным",
				introMid: "а инструменты регистрируются с префиксом",
				introAfter: "Конфигурация записывается в patch профиля и применяется мгновенно через HMR.",
				envWarning: "⚠ env / headers хранятся в открытом виде в profile cordis.patch.yml (как в официальных примерах). Не помещайте сюда долгоживущие секреты. Отключение сервера сохраняет его конфигурацию; загрузчик пропускает монтирование, и инструменты не регистрируются (невидимы для модели).",
				loading: "Загрузка…",
				empty: "Серверов MCP пока нет. Нажмите «Добавить сервер», чтобы создать.",
				addServer: "+ Добавить сервер",
				addTitle: "Добавить сервер",
				transport: "Транспорт",
				serverNameLabel: "serverName (пространство имён инструментов, должно быть уникальным)",
				serverNamePlaceholder: "github",
				commandLabel: "command",
				commandPlaceholder: "npx",
				argsLabel: "args (по одному в строке)",
				argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
				envLabel: "env (по одному key=value в строке, хранится в открытом виде)",
				envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
				cwdLabel: "cwd (необязательно)",
				urlLabel: "url",
				urlPlaceholder: "https://mcp.example.com/mcp",
				headersLabel: "headers (по одному key=value в строке, хранится в открытом виде)",
				headersPlaceholder: "Authorization=Bearer xxx",
				timeoutLabel: "toolCallTimeoutMs",
				cancel: "Отмена",
				save: "Сохранить",
				add: "Добавить",
				edit: "Изменить",
				enable: "Включить",
				disable: "Отключить",
				delete: "Удалить",
				tools: "Инструменты",
				collapse: "Свернуть",
				noTools: "(нет зарегистрированных инструментов — сервер не подключён или не синхронизирован)",
				statusDisabled: "Отключено",
				statusConnecting: "Подключение…",
				statusDisconnected: "Не подключено",
				toolCount: "{count} инструментов"
			},
			it: {
				heading: "Server MCP",
				introBefore: "Gestisci le connessioni ai server MCP. Ogni server è montato dall’",
				introMid: "ufficiale, e gli strumenti sono registrati sotto",
				introAfter: "La configurazione viene scritta nel patch del profilo e applicata al volo tramite HMR.",
				envWarning: "⚠ env / headers sono memorizzati in chiaro nel cordis.patch.yml del profilo (come negli esempi ufficiali). Non inserire segreti a lungo termine. Disabilitare un server conserva la sua configurazione; il loader salta il montaggio e gli strumenti restano non registrati (invisibili al modello).",
				loading: "Caricamento…",
				empty: "Nessun server MCP per ora. Fai clic su \"Aggiungi server\" per crearne uno.",
				addServer: "+ Aggiungi server",
				addTitle: "Aggiungi server",
				transport: "Trasporto",
				serverNameLabel: "serverName (namespace strumenti, deve essere univoco)",
				serverNamePlaceholder: "github",
				commandLabel: "command",
				commandPlaceholder: "npx",
				argsLabel: "args (uno per riga)",
				argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
				envLabel: "env (un key=value per riga, memorizzato in chiaro)",
				envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
				cwdLabel: "cwd (facoltativo)",
				urlLabel: "url",
				urlPlaceholder: "https://mcp.example.com/mcp",
				headersLabel: "headers (un key=value per riga, memorizzato in chiaro)",
				headersPlaceholder: "Authorization=Bearer xxx",
				timeoutLabel: "toolCallTimeoutMs",
				cancel: "Annulla",
				save: "Salva",
				add: "Aggiungi",
				edit: "Modifica",
				enable: "Abilita",
				disable: "Disabilita",
				delete: "Elimina",
				tools: "Strumenti",
				collapse: "Comprimi",
				noTools: "(nessuno strumento registrato — server non connesso o non sincronizzato)",
				statusDisabled: "Disabilitato",
				statusConnecting: "Connessione…",
				statusDisconnected: "Non connesso",
				toolCount: "{count} strumenti"
			},
			nl: {
				heading: "MCP-servers",
				introBefore: "Beheer MCP-serververbindingen. Elke server wordt gemount door de officiële",
				introMid: "en tools worden geregistreerd onder",
				introAfter: "De configuratie wordt naar de profile-patch geschreven en direct toegepast via HMR.",
				envWarning: "⚠ env / headers worden als platte tekst opgeslagen in profile cordis.patch.yml (zelfde vorm als de officiële voorbeelden). Zet hier geen langdurige geheimen neer. Een server uitschakelen behoudt de configuratie; de loader slaat het mounten over en tools blijven ongeregistreerd (onzichtbaar voor het model).",
				loading: "Laden…",
				empty: "Nog geen MCP-servers. Klik op \"Server toevoegen\" om er een te maken.",
				addServer: "+ Server toevoegen",
				addTitle: "Server toevoegen",
				transport: "Transport",
				serverNameLabel: "serverName (tool-naamruimte, moet uniek zijn)",
				serverNamePlaceholder: "github",
				commandLabel: "command",
				commandPlaceholder: "npx",
				argsLabel: "args (één per regel)",
				argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
				envLabel: "env (één key=value per regel, als platte tekst opgeslagen)",
				envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
				cwdLabel: "cwd (optioneel)",
				urlLabel: "url",
				urlPlaceholder: "https://mcp.example.com/mcp",
				headersLabel: "headers (één key=value per regel, als platte tekst opgeslagen)",
				headersPlaceholder: "Authorization=Bearer xxx",
				timeoutLabel: "toolCallTimeoutMs",
				cancel: "Annuleren",
				save: "Opslaan",
				add: "Toevoegen",
				edit: "Bewerken",
				enable: "Inschakelen",
				disable: "Uitschakelen",
				delete: "Verwijderen",
				tools: "Tools",
				collapse: "Inklappen",
				noTools: "(geen geregistreerde tools — server niet verbonden of niet gesynchroniseerd)",
				statusDisabled: "Uitgeschakeld",
				statusConnecting: "Verbinden…",
				statusDisconnected: "Niet verbonden",
				toolCount: "{count} tools"
			},
			sv: {
				heading: "MCP-servrar",
				introBefore: "Hantera MCP-serveranslutningar. Varje server monteras av den officiella",
				introMid: "och verktyg registreras under",
				introAfter: "Konfigurationen skrivs till profilpatchen och tillämpas direkt via HMR.",
				envWarning: "⚠ env / headers lagras i klartext i profilens cordis.patch.yml (samma form som de officiella exemplen). Lägg inte långlivade hemligheter här. Att inaktivera en server behåller konfigurationen; lastaren hoppar över monteringen och verktygen förblir oregistrerade (osynliga för modellen).",
				loading: "Läser in…",
				empty: "Inga MCP-servrar ännu. Klicka på \"Lägg till server\" för att skapa en.",
				addServer: "+ Lägg till server",
				addTitle: "Lägg till server",
				transport: "Transport",
				serverNameLabel: "serverName (verktygsnamnrymd, måste vara unik)",
				serverNamePlaceholder: "github",
				commandLabel: "command",
				commandPlaceholder: "npx",
				argsLabel: "args (en per rad)",
				argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
				envLabel: "env (en key=value per rad, lagrad i klartext)",
				envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
				cwdLabel: "cwd (valfritt)",
				urlLabel: "url",
				urlPlaceholder: "https://mcp.example.com/mcp",
				headersLabel: "headers (en key=value per rad, lagrad i klartext)",
				headersPlaceholder: "Authorization=Bearer xxx",
				timeoutLabel: "toolCallTimeoutMs",
				cancel: "Avbryt",
				save: "Spara",
				add: "Lägg till",
				edit: "Redigera",
				enable: "Aktivera",
				disable: "Inaktivera",
				delete: "Ta bort",
				tools: "Verktyg",
				collapse: "Fäll ihop",
				noTools: "(inga registrerade verktyg — servern inte ansluten eller inte synkroniserad)",
				statusDisabled: "Inaktiverad",
				statusConnecting: "Ansluter…",
				statusDisconnected: "Inte ansluten",
				toolCount: "{count} verktyg"
			},
			pl: {
				heading: "Serwery MCP",
				introBefore: "Zarządzaj połączeniami serwerów MCP. Każdy serwer jest montowany przez oficjalny",
				introMid: "a narzędzia są rejestrowane pod",
				introAfter: "Konfiguracja jest zapisywana do poprawki profilu i stosowana na żywo przez HMR.",
				envWarning: "⚠ env / headers są przechowywane w postaci zwykłego tekstu w pliku cordis.patch.yml profilu (tak jak w oficjalnych przykładach). Nie umieszczaj tu długoterminowych sekretów. Wyłączenie serwera zachowuje jego konfigurację; loader pomija montowanie, a narzędzia pozostają niezarejestrowane (niewidoczne dla modelu).",
				loading: "Wczytywanie…",
				empty: "Nie ma jeszcze serwerów MCP. Kliknij „Dodaj serwer”, aby utworzyć.",
				addServer: "+ Dodaj serwer",
				addTitle: "Dodaj serwer",
				transport: "Transport",
				serverNameLabel: "serverName (przestrzeń nazw narzędzi, musi być unikalna)",
				serverNamePlaceholder: "github",
				commandLabel: "command",
				commandPlaceholder: "npx",
				argsLabel: "args (jedno w wierszu)",
				argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
				envLabel: "env (jedno key=value w wierszu, przechowywane w postaci zwykłego tekstu)",
				envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
				cwdLabel: "cwd (opcjonalnie)",
				urlLabel: "url",
				urlPlaceholder: "https://mcp.example.com/mcp",
				headersLabel: "headers (jedno key=value w wierszu, przechowywane w postaci zwykłego tekstu)",
				headersPlaceholder: "Authorization=Bearer xxx",
				timeoutLabel: "toolCallTimeoutMs",
				cancel: "Anuluj",
				save: "Zapisz",
				add: "Dodaj",
				edit: "Edytuj",
				enable: "Włącz",
				disable: "Wyłącz",
				delete: "Usuń",
				tools: "Narzędzia",
				collapse: "Zwiń",
				noTools: "(brak zarejestrowanych narzędzi — serwer niepołączony lub niezsynchronizowany)",
				statusDisabled: "Wyłączony",
				statusConnecting: "Łączenie…",
				statusDisconnected: "Niepołączony",
				toolCount: "{count} narzędzi"
			},
			"zh-HK": {
				heading: "MCP 伺服器",
				introBefore: "管理 MCP 伺服器連線。每台伺服器由官方",
				introMid: "掛載，工具以",
				introAfter: "命名註冊。設定寫入 profile patch，HMR 即時生效。",
				envWarning: "⚠ env / headers 以明文存入 profile cordis.patch.yml（與官方範例同形態）。勿放長期密鑰。停用伺服器不會刪除設定，loader 跳過掛載，工具不會註冊（模型不可見）。",
				loading: "載入中…",
				empty: "尚無 MCP 伺服器。點擊「新增」新增一個。",
				addServer: "+ 新增伺服器",
				addTitle: "新增伺服器",
				transport: "傳輸方式",
				serverNameLabel: "serverName（工具命名空間，唯一）",
				serverNamePlaceholder: "github",
				commandLabel: "command",
				commandPlaceholder: "npx",
				argsLabel: "args（每行一個）",
				argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
				envLabel: "env（每行 key=value，明文儲存）",
				envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
				cwdLabel: "cwd（可空）",
				urlLabel: "url",
				urlPlaceholder: "https://mcp.example.com/mcp",
				headersLabel: "headers（每行 key=value，明文儲存）",
				headersPlaceholder: "Authorization=Bearer xxx",
				timeoutLabel: "toolCallTimeoutMs",
				cancel: "取消",
				save: "儲存",
				add: "新增",
				edit: "編輯",
				enable: "啟用",
				disable: "停用",
				delete: "刪除",
				tools: "工具",
				collapse: "收起",
				noTools: "（無已註冊工具——伺服器未連線或未同步）",
				statusDisabled: "已停用",
				statusConnecting: "連線中…",
				statusDisconnected: "未連線",
				toolCount: "{count} 個工具"
			},
			"zh-TW": {
				heading: "MCP 伺服器",
				introBefore: "管理 MCP 伺服器連線。每台伺服器由官方",
				introMid: "掛載，工具以",
				introAfter: "命名註冊。設定寫入 profile patch，HMR 即時生效。",
				envWarning: "⚠ env / headers 以明文存入 profile cordis.patch.yml（與官方範例同形態）。請勿放置長期密鑰。停用伺服器不會刪除設定，loader 會跳過掛載，工具不會註冊（模型看不到）。",
				loading: "載入中…",
				empty: "尚無 MCP 伺服器。點選「新增」建立一個。",
				addServer: "+ 新增伺服器",
				addTitle: "新增伺服器",
				transport: "傳輸方式",
				serverNameLabel: "serverName（工具命名空間，唯一）",
				serverNamePlaceholder: "github",
				commandLabel: "command",
				commandPlaceholder: "npx",
				argsLabel: "args（每行一個）",
				argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
				envLabel: "env（每行 key=value，明文儲存）",
				envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
				cwdLabel: "cwd（可留空）",
				urlLabel: "url",
				urlPlaceholder: "https://mcp.example.com/mcp",
				headersLabel: "headers（每行 key=value，明文儲存）",
				headersPlaceholder: "Authorization=Bearer xxx",
				timeoutLabel: "toolCallTimeoutMs",
				cancel: "取消",
				save: "儲存",
				add: "新增",
				edit: "編輯",
				enable: "啟用",
				disable: "停用",
				delete: "刪除",
				tools: "工具",
				collapse: "收起",
				noTools: "（無已註冊工具——伺服器未連線或未同步）",
				statusDisabled: "已停用",
				statusConnecting: "連線中…",
				statusDisconnected: "未連線",
				toolCount: "{count} 個工具"
			},
			"zh-MO": {
				heading: "MCP 伺服器",
				introBefore: "管理 MCP 伺服器連線。每台伺服器由官方",
				introMid: "掛載，工具以",
				introAfter: "命名註冊。設定寫入 profile patch，HMR 即時生效。",
				envWarning: "⚠ env / headers 以明文存入 profile cordis.patch.yml（與官方範例同形態）。勿放置長期密鑰。停用伺服器不會刪除設定，loader 跳過掛載，工具不註冊（模型不可見）。",
				loading: "載入中…",
				empty: "尚無 MCP 伺服器。點擊「新增」新增一個。",
				addServer: "+ 新增伺服器",
				addTitle: "新增伺服器",
				transport: "傳輸方式",
				serverNameLabel: "serverName（工具命名空間，唯一）",
				serverNamePlaceholder: "github",
				commandLabel: "command",
				commandPlaceholder: "npx",
				argsLabel: "args（每行一個）",
				argsPlaceholder: "-y\n@modelcontextprotocol/server-github",
				envLabel: "env（每行 key=value，明文儲存）",
				envPlaceholder: "GITHUB_TOKEN=ghp_xxx",
				cwdLabel: "cwd（可空）",
				urlLabel: "url",
				urlPlaceholder: "https://mcp.example.com/mcp",
				headersLabel: "headers（每行 key=value，明文儲存）",
				headersPlaceholder: "Authorization=Bearer xxx",
				timeoutLabel: "toolCallTimeoutMs",
				cancel: "取消",
				save: "儲存",
				add: "新增",
				edit: "編輯",
				enable: "啟用",
				disable: "停用",
				delete: "刪除",
				tools: "工具",
				collapse: "收起",
				noTools: "（無已註冊工具——伺服器未連線或未同步）",
				statusDisabled: "已停用",
				statusConnecting: "連線中…",
				statusDisconnected: "未連線",
				toolCount: "{count} 個工具"
			}
		};
		//#endregion
		//#region src/client/index.ts
		/** Cordis 插件名。 */
		const name = "dsh-mcp-manager-client";
		/** 需要 slots（settings.section 插槽）+ locale（面板文案 zh/en）。 */
		const inject = ["slots", "locale"];
		/** 注册设置页「MCP」面板。 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-plugin-mcp-manager: own copy namespace");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-mcp-manager",
				order: 61,
				label: () => "MCP",
				locale: NS,
				inject: () => ({})
			}, McpPanel));
			const betterLocale = ctx.get("betterLocale");
			if (betterLocale !== void 0) ctx.effect(() => betterLocale.register(NS, dicts), "dsh-plugin-mcp-manager: better-locale override dicts");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return exports;
	}
});
