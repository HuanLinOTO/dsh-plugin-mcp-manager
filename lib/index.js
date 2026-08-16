window.__ModuleLoader__.load({
	id: "@huanlin/dsh-plugin-mcp-manager",
	factory: (require) => {
		var exports = { exports: {} }.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/Panel.tsx
		/**
		* MCP 管理面板（UI 对齐官方「模型」设置页设计语言）：
		* - 服务器列表：serverName + 传输标识 + 端点摘要 + 状态 Pill（connected/
		*   disconnected）+ 工具数；行内操作：编辑 / 删除
		* - 新增/编辑表单：transport 切换（stdio ↔ streamable-http 字段组联动）；
		*   serverName/command/args/env/url/headers/超时
		* - 工具浏览：点击服务器展开其 mcp__ 工具列表（名称 + 描述），只读
		* 全部 token 走 --dsw-alias-*；零 CSS 依赖（inline 样式）。
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
		/** 设置页面板主体。 */
		function McpPanel() {
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
			/** 打开编辑表单。 */
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
			const c = editing?.config;
			const isStdio = c?.transport === "stdio";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				style: sectionStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						style: titleStyle,
						children: "MCP 服务器"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						style: introStyle,
						children: [
							"管理 MCP 服务器连接。每台服务器由官方 ",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: "@deepseek-ai/dsh-mcp-client" }),
							" 挂载， 工具以 ",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: "mcp__<serverName>__*" }),
							" 命名注册。配置写入 profile patch，HMR 实时生效。"
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: warnStyle,
						children: "⚠ env / headers 以明文存入 profile cordis.patch.yml（与官方示例同形态）。勿放长期密钥。"
					}),
					error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: errorStyle,
						children: error
					}),
					loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: introStyle,
						children: "加载中…"
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: rowsStyle,
						children: [servers.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: rowCardStyle,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: rowHeadStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										style: identityStyle,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: nameStyle,
											children: row.config.serverName
										}), row.status === "connected" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
											active: true,
											children: [row.toolCount, " 工具"]
										}) : row.status === "connecting" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, { children: "连接中…" }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, { children: "未连接" })]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										style: actionsStyle,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
												onClick: () => toggleExpand(row.id),
												disabled: busy,
												children: expanded.has(row.id) ? "收起" : "工具"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
												onClick: () => startEdit(row),
												disabled: busy,
												children: "编辑"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
												onClick: () => void remove(row.id),
												disabled: busy,
												children: "删除"
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
										children: "（无已注册工具——服务器未连接或未同步）"
									}) : toolGroups[row.config.serverName].map((t) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: toolRowStyle,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: toolNameStyle,
											children: t.rawName
										}), t.description !== void 0 && t.description.length > 0 ? ` — ${t.description}` : ""]
									}, t.name))
								})
							]
						}, row.id)), servers.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: introStyle,
							children: "尚无 MCP 服务器。点击「新增」添加。"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: editorActionsStyle,
						children: editing === void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							onClick: startAdd,
							disabled: busy,
							children: "+ 新增服务器"
						})
					}),
					editing !== void 0 && c !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: editorStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: fieldStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									style: fieldLabelStyle,
									children: "传输方式"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										display: "flex",
										gap: 8
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										onClick: () => switchTransport("stdio"),
										disabled: busy,
										children: isStdio ? "✓ stdio" : "stdio"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										onClick: () => switchTransport("streamable-http"),
										disabled: busy,
										children: !isStdio ? "✓ streamable-http" : "streamable-http"
									})]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: fieldStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									style: fieldLabelStyle,
									children: "serverName（工具命名空间，唯一）"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
									value: c.serverName,
									onChange: (e) => setEditing((p) => p === void 0 ? p : {
										...p,
										config: {
											...p.config,
											serverName: e.target.value
										}
									}),
									disabled: busy,
									placeholder: "github"
								})]
							}),
							isStdio ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: fieldStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										style: fieldLabelStyle,
										children: "command"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
										value: c.command ?? "",
										onChange: (e) => setEditing((p) => p === void 0 ? p : {
											...p,
											config: {
												...p.config,
												command: e.target.value
											}
										}),
										disabled: busy,
										placeholder: "npx"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: fieldStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										style: fieldLabelStyle,
										children: "args（每行一个）"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										value: (c.args ?? []).join("\n"),
										onChange: (e) => setEditing((p) => p === void 0 ? p : {
											...p,
											config: {
												...p.config,
												args: e.target.value.split("\n")
											}
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
										placeholder: "-y\n@modelcontextprotocol/server-github"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: fieldStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										style: fieldLabelStyle,
										children: "env（每行 key=value，明文存储）"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										value: envText,
										onChange: (e) => setEnvText(e.target.value),
										disabled: busy,
										rows: 3,
										style: {
											fontSize: 12,
											fontFamily: "ui-monospace, monospace",
											borderRadius: 8,
											border: "1px solid var(--dsw-alias-border-l2)",
											padding: "8px 10px"
										},
										placeholder: "GITHUB_TOKEN=ghp_xxx"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: fieldStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										style: fieldLabelStyle,
										children: "cwd（可空）"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
										value: c.cwd ?? "",
										onChange: (e) => setEditing((p) => p === void 0 ? p : {
											...p,
											config: {
												...p.config,
												cwd: e.target.value
											}
										}),
										disabled: busy,
										placeholder: ""
									})]
								})
							] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: fieldStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									style: fieldLabelStyle,
									children: "url"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
									value: c.url ?? "",
									onChange: (e) => setEditing((p) => p === void 0 ? p : {
										...p,
										config: {
											...p.config,
											url: e.target.value
										}
									}),
									disabled: busy,
									placeholder: "https://mcp.example.com/mcp"
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: fieldStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									style: fieldLabelStyle,
									children: "headers（每行 key=value，明文存储）"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									value: headersText,
									onChange: (e) => setHeadersText(e.target.value),
									disabled: busy,
									rows: 3,
									style: {
										fontSize: 12,
										fontFamily: "ui-monospace, monospace",
										borderRadius: 8,
										border: "1px solid var(--dsw-alias-border-l2)",
										padding: "8px 10px"
									},
									placeholder: "Authorization=Bearer xxx"
								})]
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: fieldStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									style: fieldLabelStyle,
									children: "toolCallTimeoutMs"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
									type: "number",
									value: String(c.toolCallTimeoutMs ?? 6e4),
									onChange: (e) => setEditing((p) => p === void 0 ? p : {
										...p,
										config: {
											...p.config,
											toolCallTimeoutMs: Number(e.target.value) || 6e4
										}
									}),
									disabled: busy
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: editorActionsStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									onClick: () => setEditing(void 0),
									disabled: busy,
									children: "取消"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									onClick: () => void save(),
									disabled: busy,
									children: editing.id.length > 0 ? "保存" : "添加"
								})]
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Cordis 插件名。 */
		const name = "dsh-mcp-manager-client";
		/** 需要 slots（settings.section 插槽）。 */
		const inject = ["slots"];
		/** 注册设置页「MCP」面板。 */
		function apply(ctx) {
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-mcp-manager",
				order: 61,
				label: () => "MCP",
				inject: () => ({})
			}, McpPanel));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return exports;
	}
});
