# SD-OutfitHub
一个轻量的本地化项目，用于管理和检索 Stable Diffusion 服装相关提示词数据。

主要文件
- `index.html` — 前端界面
- `server.js` — Express 后端（静态托管 + 数据 API + 检索 API）
- `assets/resource-pack.json` — 图标资源包索引
- `assets/icons/` — 默认应用图标与 favicon
- `prompt-data.json` — 本地提示数据（已加入 `.gitignore`，不随仓库提交）
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
- 服装模块结构：按“风格”分组，每个风格下含 `上衣(tops) / 下装(bottoms) / 鞋子(shoes) / 头饰(headwear) / 配件(accessories) / 武器(weapons) / 其他(others)` 子分类
- 服装页支持按子分类筛选显示（全部 / 上衣 / 下装 / 鞋子 / 头饰 / 配件 / 武器 / 其他）
- 角色标签支持分类写法：`分类:标签`（例如 `阵营:维多利亚`），筛选区会按分类分组展示

快速使用
1. 在项目目录运行：`npm install`
2. 启动：`npm start` 或 双击 `start-windows.bat`
3. 打开浏览器访问 `http://localhost:3000`（端口以 `server.js` 配置为准）

后端 API（当前架构）
- `GET /api/prompts`：读取完整提示词数据库
- `POST /api/prompts/mutate`：执行后端业务变更（新增/编辑/删除）
- `PUT /api/prompts`：兼容全量覆盖保存（保留）
- `GET /api/agent-skill/search`：关键词检索

说明
- 现在数据写操作统一在 Express 后端执行，前端不再直接“本地改对象再写文件”。
- 前端通过 Fetch 调用后端变更接口，后端完成校验、落盘并返回最新数据快照。

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

重要声明
该项目纯属个人 vibe coding 产物，缺乏安全性、输入校验和错误处理。强烈不建议在生产环境或公开场合使用或直接共享。