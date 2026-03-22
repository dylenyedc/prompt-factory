# SD-OutfitHub
一个轻量的本地化项目，用于管理和检索 Stable Diffusion 服装相关提示词数据。

主要文件
- `index.html` — 前端界面
- `server.js` — Express 后端（静态托管 + 数据 API + 检索 API）
- `db.js` — SQLite 数据层（建表、读写、检索、迁移辅助）
- `assets/resource-pack.json` — 图标资源包索引
- `assets/icons/` — 默认应用图标与 favicon
- `data.sqlite` — SQLite 主数据库（默认不提交）
- `package.json` — 依赖与启动脚本
- `start-windows.bat` — 便于在 Windows 下启动

前端架构（简版）
- `scripts/core/`：基础层（状态、工具、数据读写、启动入口）
	- `state.js`：全局状态与 DOM 引用
	- `utils.js`：通用工具函数（转义、深拷贝、ID、标签解析）
	- `data.js`：与后端 API 的 Fetch 通信（`/api/prompts`、`/api/prompts/mutate`）与数据标准化
	- `main.js`：应用初始化与启动
- `scripts/features/`：功能层（界面渲染、业务动作、事件绑定）
	- `render.js`：卡片与筛选渲染、切页显示
	- `actions.js`：通过 Fetch 调后端 API 完成增删改、复制、Toast 等业务动作
	- `events.js`：按钮与输入框事件绑定
- 加载顺序：`core/state -> core/utils -> core/data -> features/render -> features/actions -> features/events -> core/main`
- 业务模块：`人物 / 动作 / 环境质量 / 服装`
- 动作模块结构：单层条目卡片（无二级菜单），每个条目支持标签（逗号分隔）与 prompt 内容
- 环境质量模块结构：单层条目卡片（无二级菜单），每个条目支持标签（逗号分隔）与 prompt 内容
- 服装模块结构：单层条目卡片（无二级菜单），每个条目包含标签字段：`部位(必填) / 风格 / 来源角色 / 安全性(SFW|NSFW) / 其他`，并保留 `prompt` 内容
- 角色标签支持分类写法：`分类:标签`（例如 `阵营:维多利亚`），筛选区会按分类分组展示

快速使用
1. 在项目目录运行：`npm install`
2. 启动：`npm start` 或 双击 `start-windows.bat`
3. 打开浏览器访问 `http://localhost:3000`（端口以 `server.js` 配置为准）

后端 API
- `GET /api/auth/github/start`：跳转到 GitHub 授权页
- `GET /api/auth/github/callback`：GitHub 回调并签发本地 access/refresh token
- `POST /api/auth/refresh`：刷新 access token（并轮换 refresh token）
- `GET /api/auth/me`：读取当前登录状态与管理员标记
- `POST /api/auth/activate-admin`：使用激活码将当前账号升级为管理员
- `GET /api/prompts`：读取完整提示词数据库（由 SQLite 重建 JSON 结构）
- `GET /api/prompts/export`：下载 `prompt-data.json` 格式导出（浏览器附件下载）
- `POST /api/prompts/mutate`：执行后端业务变更（新增/编辑/删除）
- `PUT /api/prompts`：全量覆盖写入（用于导入/同步，仅管理员）
- `POST /api/prompts/import-root`：从项目根目录读取 `data.json` 或 `prompt-data.json` 并覆盖导入（仅管理员）
- `GET /api/characters`：读取角色列表
- `POST /api/characters`：创建角色
- `PUT /api/characters/:id`：更新角色
- `DELETE /api/characters/:id`：删除角色
- `GET /api/agent-skill/search`：关键词检索

已弃用
- `GET /api/chars` 已移除，请统一使用 `GET /api/characters`。

说明
- 数据主存储已切换为 `data.sqlite`（SQLite）。
- 前端保持 Fetch API 调用，不直接读写本地 JSON。
- 若已有 `data.json` 或 `prompt-data.json`，可执行迁移脚本导入 SQLite。
- 所有业务数据均带 `owner_user_id`，业务查询默认按当前登录用户隔离。
- `GET /api/prompts` 与 `GET /api/prompts/export` 支持未登录只读访问。
- 写接口（如 `POST /api/prompts/mutate`、`PUT /api/prompts`）仍需 Bearer token。
- 登录用户若首次无私有数据，会自动从公共模板初始化一份可编辑数据。
- 本地账号注册/密码登录已禁用，仅允许 GitHub OAuth 登录。

用户认证（GitHub OAuth） 配置
1. 在 GitHub 创建 OAuth App。
2. 回调地址设置为：`http://localhost:3000/api/auth/github/callback`（或你的端口）。
3. 配置敏感信息（二选一）：
	- 环境变量
	- 或复制 `secrets.example.json` 为 `secrets.local.json` 后填写
4. 必需配置项：
	- `GITHUB_CLIENT_ID`
	- `GITHUB_CLIENT_SECRET`
	- `ACCESS_TOKEN_SECRET`
	- `ADMIN_ACTIVATION_CODE`（用于管理员激活）
	- 可选：`GITHUB_CALLBACK_URL`
5. 打开页面后，在“个人信息”页点击“使用 GitHub 登录”。
6. 如需启用批量 JSON 导入，在“个人信息”页输入管理员激活码并激活管理员权限。
7. 导入支持两种方式（同一导入功能区）：
	- 上传本地 JSON 文件（浏览器选择文件）
	- 从项目根目录直接导入（读取 `data.json` 或 `prompt-data.json`）

Agent Skill（关键词检索提示词）
- 接口：`GET /api/agent-skill/search`
- 作用：允许 Agent 按关键词访问本地提示词数据库，并返回匹配结果
- 支持：模糊检索（名称、分组标题、标签、prompt 内容）

查询参数
- `keyword` 或 `q`：检索关键词（必填）
- `limit`：返回数量，默认 10，最大 100
- `section`：限定检索范围，可选 `chars` / `actions` / `env` / `outfit`

示例
- `/api/agent-skill/search?keyword=goldenglow`
- `/api/agent-skill/search?q=礼服&section=chars&limit=20`

返回结构（简要）
- `skill`：技能名（固定为 `prompt-search`）
- `query`：原始检索词
- `section`：检索范围
- `total`：命中条数
- `results`：结果列表（含 `itemName`、`prompt`、`score`、`matchedFields` 等）

