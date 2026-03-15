# SD-OutfitHub
一个支持多用户的 Stable Diffusion 服装提示词管理与检索 Web 应用。

## 功能

- **多用户账号系统**：邮箱/密码注册与登录，每位用户数据完全隔离
- **提示词管理**：角色、动作、环境、服装四大模块，支持增删改查与分类标签
- **关键词检索**：`/api/agent-skill/search` 接口，支持模糊/前缀/子序列打分匹配
- **数据持久化**：SQLite（本地开发）/ PostgreSQL（线上生产）均支持，通过 Prisma ORM 管理

---

## 快速开始（本地开发）

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，设置 SESSION_SECRET 等（本地开发保持默认也可以）
```

`.env` 默认内容（SQLite + 开发模式）：

```
PORT=3000
DATABASE_URL="file:./dev.db"
SESSION_SECRET=change-me-to-a-long-random-secret
NODE_ENV=development
```

### 3. 初始化数据库

```bash
npx prisma migrate deploy   # 应用迁移（初次使用或新环境）
npx prisma generate         # 生成 Prisma Client（如果缺失）
```

### 4. 启动

```bash
npm start         # 生产启动
npm run dev       # 同上（开发模式）
```

浏览器访问 `http://localhost:3000`，首次使用点击"注册"创建账号。

---

## 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务监听端口 | `3000` |
| `DATABASE_URL` | 数据库连接字符串 | `file:./dev.db`（SQLite） |
| `SESSION_SECRET` | Cookie session 加密密钥 | `dev-secret-change-in-production` |
| `NODE_ENV` | 运行环境 | `development` |

**生产环境请务必设置强随机 `SESSION_SECRET`，例如：**

```bash
openssl rand -hex 32
```

---

## 线上部署（PostgreSQL）

1. 将 `DATABASE_URL` 改为 PostgreSQL 连接字符串：

   ```
   DATABASE_URL="postgresql://user:password@host:5432/sd_outfithub?schema=public"
   ```

2. 在 `prisma/schema.prisma` 中将 `provider = "sqlite"` 改为 `provider = "postgresql"`

3. 运行迁移：

   ```bash
   npx prisma migrate deploy
   ```

4. 启动服务：

   ```bash
   npm start
   ```

> **安全提示**：生产环境应使用 HTTPS，并在反向代理（Nginx/Caddy 等）后面运行 Node 服务。同时设置 `NODE_ENV=production`，以启用安全 cookie。

---

## API 说明

### 鉴权接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/register` | 注册 `{ email, password }` |
| `POST` | `/api/auth/login` | 登录 `{ email, password }` |
| `POST` | `/api/auth/logout` | 退出登录 |
| `GET`  | `/api/me` | 获取当前登录用户信息 |

### 数据接口（需登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/prompts` | 获取当前用户全量提示词数据 |
| `PUT` | `/api/prompts` | 覆盖写入当前用户提示词数据 |

### 检索接口（需登录）

```
GET /api/agent-skill/search?keyword=<关键词>&section=<chars|actions|env|outfit>&limit=<1-100>
```

示例：

```
/api/agent-skill/search?keyword=goldenglow
/api/agent-skill/search?q=礼服&section=chars&limit=20
```

返回结构同原版：`skill / query / section / total / results`（含 `itemName`、`prompt`、`score`、`matchedFields`）

---

## 项目结构

```
SD-OutfitHub/
├── prisma/
│   ├── schema.prisma        # 数据库模型
│   └── migrations/          # 自动生成的迁移文件
├── src/
│   ├── app.js               # Express 应用入口
│   ├── db.js                # Prisma Client 单例
│   ├── middleware/
│   │   └── requireAuth.js   # 登录校验中间件
│   └── routes/
│       ├── auth.js          # 注册/登录/退出/me
│       ├── prompts.js       # 提示词 CRUD
│       └── search.js        # 关键词检索
├── scripts/
│   ├── auth.js              # 前端鉴权辅助模块
│   └── core/ features/      # 原有前端模块
├── tests/
│   └── auth.test.js         # 自动化测试
├── index.html               # 前端页面（含登录弹窗）
├── server.js                # 启动入口
├── .env.example             # 环境变量模板
└── package.json
```

---

## npm 脚本

| 命令 | 说明 |
|------|------|
| `npm start` | 启动服务 |
| `npm run dev` | 同上（开发模式） |
| `npm run prisma:generate` | 重新生成 Prisma Client |
| `npm run prisma:migrate` | 应用迁移（生产环境） |
| `npm run prisma:migrate:dev` | 开发环境创建并应用迁移 |
| `npm test` | 运行自动化测试 |

---

## 注册与登录使用说明

1. 打开 `http://localhost:3000`，页面会弹出登录/注册卡片
2. 切换"注册"标签，填写邮箱（格式 `xxx@xxx.xxx`）和至少 8 位密码，点击"注册"
3. 注册成功后自动登录，进入提示词管理页
4. 侧边栏底部显示当前登录邮箱，点击"退出登录"可登出

---

## 数据库 Schema（简览）

- **User**：`id, email(unique), passwordHash, createdAt`
- **Group**：`id, userId, section(chars/actions/env/outfit), title, tagsText(JSON), createdAt, updatedAt`
- **Item**：`id, userId, groupId, name, prompt, categoryKey(nullable), createdAt, updatedAt`

---

## 下一步可选改进

- [ ] 分组/条目级别细粒度 CRUD API（目前是整份覆盖写入）
- [ ] 将 `tagsText` 升级为关系表 `Tag + GroupTag`
- [ ] 生产 session store（如 `connect-pg-simple` 或 Redis）
- [ ] 限流（`express-rate-limit`）
- [ ] 导入/导出 JSON 功能
- [ ] 社区与个人信息页面
- [ ] OAuth 登录（GitHub/Google）

---

## 重要声明

该项目已加入基础的登录鉴权与数据库存储，但仍处于 MVP 阶段。部署到公网前，请务必：
- 使用强随机 `SESSION_SECRET`
- 配置 HTTPS
- 定期备份数据库
- 评估并加固速率限制与输入校验策略
