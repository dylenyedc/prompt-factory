const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const {
  OUTFIT_CATEGORY_KEYS,
  newId,
  parseTags,
  normalizePromptData,
  openDatabase,
  adoptOrphanData,
  replaceAllData,
  getPromptData,
  getCharacters,
  searchPromptDatabase
} = require('./db');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 3600);
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

function loadLocalSecrets() {
  const filePath = path.join(ROOT_DIR, 'secrets.local.json');
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

const localSecrets = loadLocalSecrets();
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET
  || localSecrets.ACCESS_TOKEN_SECRET
  || crypto.randomBytes(32).toString('hex');

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || localSecrets.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || localSecrets.GITHUB_CLIENT_SECRET || '';
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL
  || localSecrets.GITHUB_CALLBACK_URL
  || `http://localhost:${PORT}/api/auth/github/callback`;
const ADMIN_ACTIVATION_CODE = process.env.ADMIN_ACTIVATION_CODE || localSecrets.ADMIN_ACTIVATION_CODE || '';

if (!process.env.ACCESS_TOKEN_SECRET && !localSecrets.ACCESS_TOKEN_SECRET) {
  console.warn('[Security] ACCESS_TOKEN_SECRET 未配置：当前进程使用临时随机密钥，重启后 token 会失效。');
}

if (!ADMIN_ACTIVATION_CODE) {
  console.warn('[Security] ADMIN_ACTIVATION_CODE 未配置：管理员激活功能将不可用。');
}

const db = openDatabase();

function requireString(value, message) {
  const text = String(value || '').trim();
  if (!text) {
    throw new Error(message);
  }
  return text;
}

function optionalTrimmedString(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function resolveDisplayName(user) {
  if (!user || typeof user !== 'object') {
    return '';
  }
  const displayName = optionalTrimmedString(user.display_name);
  if (displayName) {
    return displayName;
  }
  return optionalTrimmedString(user.username);
}

function nowMs() {
  return Date.now();
}

function nowSec() {
  return Math.floor(nowMs() / 1000);
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input) {
  const normalized = String(input).replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = pad ? (normalized + '='.repeat(4 - pad)) : normalized;
  return Buffer.from(padded, 'base64');
}

function signToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, exp: nowSec() + ACCESS_TOKEN_TTL_SECONDS };
  const head = base64UrlEncode(JSON.stringify(header));
  const part = base64UrlEncode(JSON.stringify(body));
  const data = `${head}.${part}`;
  const signature = base64UrlEncode(crypto.createHmac('sha256', ACCESS_TOKEN_SECRET).update(data).digest());
  return `${data}.${signature}`;
}

function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    throw new Error('token format invalid');
  }

  const [head, body, signature] = parts;
  const data = `${head}.${body}`;
  const expected = base64UrlEncode(crypto.createHmac('sha256', ACCESS_TOKEN_SECRET).update(data).digest());
  if (signature !== expected) {
    throw new Error('token signature invalid');
  }

  const payload = JSON.parse(base64UrlDecode(body).toString('utf8'));
  if (!payload || typeof payload !== 'object' || !payload.exp) {
    throw new Error('token payload invalid');
  }

  if (Number(payload.exp) <= nowSec()) {
    throw new Error('token expired');
  }

  return payload;
}

function hashRefreshToken(refreshToken) {
  return crypto.createHash('sha256').update(String(refreshToken || '')).digest('hex');
}

function issueTokens(user) {
  const accessToken = signToken({ sub: user.id, username: user.username });
  const rawRefreshToken = crypto.randomBytes(48).toString('hex');
  const refreshTokenHash = hashRefreshToken(rawRefreshToken);
  const expireAt = nowMs() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

  db.prepare('INSERT INTO refresh_tokens(id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(newId(), user.id, refreshTokenHash, expireAt, nowMs());

  return {
    accessToken,
    refreshToken: rawRefreshToken
  };
}

function rotateRefreshToken(refreshToken) {
  const tokenHash = hashRefreshToken(refreshToken);
  const record = db.prepare('SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = ?').get(tokenHash);
  if (!record) {
    throw new Error('refresh token 无效');
  }

  if (Number(record.expires_at) <= nowMs()) {
    db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(record.id);
    throw new Error('refresh token 已过期');
  }

  const user = db.prepare('SELECT id, username, display_name, avatar_url FROM users WHERE id = ?').get(record.user_id);
  if (!user) {
    db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(record.id);
    throw new Error('用户不存在');
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(record.id);
    return issueTokens(user);
  });

  return tx();
}

function authRequired(req, res, next) {
  try {
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: '缺少登录凭证' });
      return;
    }

    const token = authHeader.slice(7).trim();
    const payload = verifyToken(token);
    const userId = String(payload.sub || '');
    if (!userId) {
      res.status(401).json({ message: '登录凭证无效' });
      return;
    }

    const user = db.prepare('SELECT id, username, display_name, avatar_url, is_admin FROM users WHERE id = ?').get(userId);
    if (!user) {
      res.status(401).json({ message: '用户不存在' });
      return;
    }

    req.user = {
      id: user.id,
      username: user.username,
      nickname: resolveDisplayName(user),
      isAdmin: Number(user.is_admin) === 1
    };
    next();
  } catch (_) {
    res.status(401).json({ message: '登录凭证已过期或无效' });
  }
}

function authOptional(req, _res, next) {
  try {
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ')) {
      req.user = null;
      req.authError = null;
      next();
      return;
    }

    const token = authHeader.slice(7).trim();
    const payload = verifyToken(token);
    const userId = String(payload.sub || '');
    if (!userId) {
      req.user = null;
      req.authError = '登录凭证无效';
      next();
      return;
    }

    const user = db.prepare('SELECT id, username, display_name, avatar_url, is_admin FROM users WHERE id = ?').get(userId);
    if (!user) {
      req.user = null;
      req.authError = '用户不存在';
      next();
      return;
    }

    req.user = {
      id: user.id,
      username: user.username,
      nickname: resolveDisplayName(user),
      isAdmin: Number(user.is_admin) === 1
    };
    req.authError = null;
  } catch (_) {
    req.user = null;
    req.authError = '登录凭证已过期或无效';
  }
  next();
}

function ensureAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    res.status(403).json({ message: '仅管理员可执行此操作' });
    return;
  }
  next();
}

function canManageOwner(user, ownerUserId) {
  if (!user || !user.id) {
    return false;
  }
  if (user.isAdmin) {
    return true;
  }
  return String(ownerUserId || '') === String(user.id || '');
}

function ensureCanManageOwner(user, ownerUserId) {
  if (!canManageOwner(user, ownerUserId)) {
    throw new Error('仅管理员可编辑或删除其他用户上传的数据');
  }
}

function getPromptDataSnapshot(ownerUserId, options = {}) {
  return getPromptData(db, ownerUserId, options);
}

function getMergedPromptDataSnapshot() {
  return getPromptDataSnapshot('', { includeAllOwners: true, includeUploader: true });
}

function hasAnyPromptGroups(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }
  return ['chars', 'actions', 'env', 'outfit'].some(section => Array.isArray(data[section]) && data[section].length > 0);
}

function getPublicPromptDataSnapshot() {
  const publicData = getPromptData(db, '');
  if (hasAnyPromptGroups(publicData)) {
    return publicData;
  }

  try {
    const filePath = path.join(ROOT_DIR, 'prompt-data.json');
    if (!fs.existsSync(filePath)) {
      return normalizePromptData({ chars: [], actions: [], env: [], outfit: [] });
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizePromptData(parsed);
  } catch (_) {
    return normalizePromptData({ chars: [], actions: [], env: [], outfit: [] });
  }
}

function ensureUserPromptDataInitialized(userId) {
  const owner = String(userId || '').trim();
  if (!owner) {
    return;
  }

  const existing = getPromptDataSnapshot(owner);
  if (hasAnyPromptGroups(existing)) {
    return;
  }

  const template = getPublicPromptDataSnapshot();
  if (!hasAnyPromptGroups(template)) {
    return;
  }

  replaceAllData(db, clonePromptDataWithFreshIds(template), owner);
}

function clonePromptDataWithFreshIds(data) {
  const normalized = normalizePromptData(data);

  return {
    chars: normalized.chars.map(group => ({
      id: newId(),
      title: group.title,
      tags: Array.isArray(group.tags) ? [...group.tags] : [],
      items: (Array.isArray(group.items) ? group.items : []).map(item => ({
        id: newId(),
        name: item.name,
        prompt: item.prompt
      }))
    })),
    actions: normalized.actions.map(group => ({
      id: newId(),
      title: group.title,
      items: (Array.isArray(group.items) ? group.items : []).map(item => ({
        id: newId(),
        name: item.name,
        prompt: item.prompt
      }))
    })),
    env: normalized.env.map(group => ({
      id: newId(),
      title: group.title,
      items: (Array.isArray(group.items) ? group.items : []).map(item => ({
        id: newId(),
        name: item.name,
        prompt: item.prompt
      }))
    })),
    outfit: normalized.outfit.map(group => {
      const nextGroup = {
        id: newId(),
        title: group.title
      };

      OUTFIT_CATEGORY_KEYS.forEach(categoryKey => {
        const items = Array.isArray(group[categoryKey]) ? group[categoryKey] : [];
        nextGroup[categoryKey] = items.map(item => ({
          id: newId(),
          name: item.name,
          prompt: item.prompt
        }));
      });

      return nextGroup;
    })
  };
}

function findPromptGroupTable(section) {
  if (section === 'actions' || section === 'env') {
    return 'prompt_groups';
  }
  if (section === 'chars') {
    return 'characters';
  }
  if (section === 'outfit') {
    return 'outfits';
  }
  return '';
}

function mutateByAction(actorUser, action, payload = {}) {
  if (!actorUser || !actorUser.id) {
    throw new Error('缺少用户上下文');
  }

  const actor = {
    id: String(actorUser.id),
    isAdmin: !!actorUser.isAdmin
  };

  const tx = db.transaction(() => {
    if (action === 'addCharGroup') {
      const title = requireString(payload.title, '请输入角色分组名称');
      const existed = db.prepare('SELECT 1 FROM characters WHERE owner_user_id = ? AND title = ?').get(actor.id, title);
      if (existed) {
        throw new Error('该角色分组已存在');
      }
      db.prepare('INSERT INTO characters(id, owner_user_id, title, tags_json) VALUES (?, ?, ?, ?)').run(newId(), actor.id, title, '[]');
      return '已新增角色分组';
    }

    if (action === 'addOutfitGroup') {
      const title = requireString(payload.title, '请输入服装风格名称');
      const existed = db.prepare('SELECT 1 FROM outfits WHERE owner_user_id = ? AND title = ?').get(actor.id, title);
      if (existed) {
        throw new Error('该服装风格已存在');
      }
      db.prepare('INSERT INTO outfits(id, owner_user_id, title) VALUES (?, ?, ?)').run(newId(), actor.id, title);
      return '已新增服装风格';
    }

    if (action === 'editCharGroupTags') {
      const groupId = requireString(payload.groupId, '角色分组不存在');
      const group = db.prepare('SELECT owner_user_id FROM characters WHERE id = ?').get(groupId);
      if (!group) {
        throw new Error('角色分组不存在');
      }
      ensureCanManageOwner(actor, group.owner_user_id);
      const tags = Array.isArray(payload.tags) ? payload.tags : parseTags(payload.tagsRaw || '');
      db.prepare('UPDATE characters SET tags_json = ? WHERE owner_user_id = ? AND id = ?').run(JSON.stringify(tags), group.owner_user_id, groupId);
      return '角色标签已更新';
    }

    if (action === 'addCharTag') {
      const groupId = requireString(payload.groupId, '角色分组不存在');
      const tag = requireString(payload.tag, '标签不能为空');
      const row = db.prepare('SELECT owner_user_id, tags_json FROM characters WHERE id = ?').get(groupId);
      if (!row) {
        throw new Error('角色分组不存在');
      }
      ensureCanManageOwner(actor, row.owner_user_id);
      let tags = [];
      try {
        tags = JSON.parse(row.tags_json || '[]');
      } catch (_) {
        tags = [];
      }
      tags = Array.isArray(tags) ? tags : [];
      if (tags.includes(tag)) {
        throw new Error('该标签已存在');
      }
      tags.push(tag);
      db.prepare('UPDATE characters SET tags_json = ? WHERE owner_user_id = ? AND id = ?').run(JSON.stringify(tags), row.owner_user_id, groupId);
      return '标签已添加';
    }

    if (action === 'editCharTag') {
      const groupId = requireString(payload.groupId, '角色分组不存在');
      const oldTag = requireString(payload.oldTag, '标签不存在');
      const nextTag = requireString(payload.nextTag, '标签不能为空');
      const row = db.prepare('SELECT owner_user_id, tags_json FROM characters WHERE id = ?').get(groupId);
      if (!row) {
        throw new Error('角色分组不存在');
      }
      ensureCanManageOwner(actor, row.owner_user_id);
      let tags = [];
      try {
        tags = JSON.parse(row.tags_json || '[]');
      } catch (_) {
        tags = [];
      }
      tags = Array.isArray(tags) ? tags : [];
      const index = tags.indexOf(oldTag);
      if (index < 0) {
        throw new Error('标签不存在');
      }
      if (oldTag !== nextTag && tags.includes(nextTag)) {
        throw new Error('该标签已存在');
      }
      tags[index] = nextTag;
      db.prepare('UPDATE characters SET tags_json = ? WHERE owner_user_id = ? AND id = ?').run(JSON.stringify(tags), row.owner_user_id, groupId);
      return '标签已更新';
    }

    if (action === 'deleteCharTag') {
      const groupId = requireString(payload.groupId, '角色分组不存在');
      const tag = requireString(payload.tag, '标签不存在');
      const row = db.prepare('SELECT owner_user_id, tags_json FROM characters WHERE id = ?').get(groupId);
      if (!row) {
        throw new Error('角色分组不存在');
      }
      ensureCanManageOwner(actor, row.owner_user_id);
      let tags = [];
      try {
        tags = JSON.parse(row.tags_json || '[]');
      } catch (_) {
        tags = [];
      }
      tags = Array.isArray(tags) ? tags : [];
      if (!tags.includes(tag)) {
        throw new Error('标签不存在');
      }
      const next = tags.filter(item => item !== tag);
      db.prepare('UPDATE characters SET tags_json = ? WHERE owner_user_id = ? AND id = ?').run(JSON.stringify(next), row.owner_user_id, groupId);
      return '标签已删除';
    }

    if (action === 'renameCharGroup') {
      const groupId = requireString(payload.groupId, '角色分组不存在');
      const title = requireString(payload.title, '角色名称不能为空');
      const existed = db.prepare('SELECT owner_user_id FROM characters WHERE id = ?').get(groupId);
      if (!existed) {
        throw new Error('角色分组不存在');
      }
      ensureCanManageOwner(actor, existed.owner_user_id);
      const duplicated = db.prepare('SELECT 1 FROM characters WHERE owner_user_id = ? AND title = ? AND id <> ?').get(existed.owner_user_id, title, groupId);
      if (duplicated) {
        throw new Error('角色名称已存在');
      }
      db.prepare('UPDATE characters SET title = ? WHERE owner_user_id = ? AND id = ?').run(title, existed.owner_user_id, groupId);
      return '角色名称已更新';
    }

    if (action === 'deleteCharGroup') {
      const groupId = requireString(payload.groupId, '角色分组不存在');
      const existed = db.prepare('SELECT owner_user_id FROM characters WHERE id = ?').get(groupId);
      if (!existed) {
        throw new Error('角色分组不存在');
      }
      ensureCanManageOwner(actor, existed.owner_user_id);
      db.prepare("DELETE FROM prompts WHERE owner_user_id = ? AND section = 'chars' AND group_id = ?").run(existed.owner_user_id, groupId);
      db.prepare('DELETE FROM characters WHERE owner_user_id = ? AND id = ?').run(existed.owner_user_id, groupId);
      return '角色已删除';
    }

    if (action === 'deleteItem') {
      const tabId = requireString(payload.tabId, '分组类型无效');
      if (!['chars', 'actions', 'env'].includes(tabId)) {
        throw new Error('分组类型无效');
      }
      const groupId = requireString(payload.groupId, '未找到所属分组');
      const itemId = requireString(payload.itemId, '条目不存在，无法删除');
      const existed = db.prepare('SELECT owner_user_id FROM prompts WHERE id = ? AND section = ? AND group_id = ?').get(itemId, tabId, groupId);
      if (!existed) {
        throw new Error('条目不存在，无法删除');
      }
      ensureCanManageOwner(actor, existed.owner_user_id);
      const removed = db.prepare('DELETE FROM prompts WHERE owner_user_id = ? AND id = ? AND section = ? AND group_id = ?').run(existed.owner_user_id, itemId, tabId, groupId);
      if (!removed.changes) {
        throw new Error('条目不存在，无法删除');
      }
      return '条目已删除';
    }

    if (action === 'saveItem') {
      const tabId = requireString(payload.tabId, '分组类型无效');
      const groupId = requireString(payload.groupId, '未找到所属分组');
      const itemId = requireString(payload.itemId, '条目不存在，可能已被删除');
      const name = requireString(payload.name, '请填写完整信息');
      const prompt = requireString(payload.prompt, '请填写完整信息');
      const categoryKey = String(payload.categoryKey || '');

      if (tabId === 'outfit') {
        if (!OUTFIT_CATEGORY_KEYS.includes(categoryKey)) {
          throw new Error('服装分类无效');
        }
      } else if (!['chars', 'actions', 'env'].includes(tabId)) {
        throw new Error('分组类型无效');
      }

      const existed = db.prepare('SELECT owner_user_id FROM prompts WHERE id = ? AND section = ? AND group_id = ?').get(itemId, tabId, groupId);
      if (!existed) {
        throw new Error('条目不存在，可能已被删除');
      }
      ensureCanManageOwner(actor, existed.owner_user_id);

      const updated = db.prepare('UPDATE prompts SET name = ?, prompt = ? WHERE owner_user_id = ? AND id = ? AND section = ? AND group_id = ?')
        .run(name, prompt, existed.owner_user_id, itemId, tabId, groupId);
      if (!updated.changes) {
        throw new Error('条目不存在，可能已被删除');
      }
      return '提示词已更新';
    }

    if (action === 'addItem') {
      const tabId = requireString(payload.tabId, '分组类型无效');
      const groupId = requireString(payload.groupId, '未找到分组');
      const name = requireString(payload.name, '请填写完整信息');
      const prompt = requireString(payload.prompt, '请填写完整信息');
      let categoryKey = '';

      if (tabId === 'outfit') {
        categoryKey = requireString(payload.categoryKey, '服装分类无效');
        if (!OUTFIT_CATEGORY_KEYS.includes(categoryKey)) {
          throw new Error('服装分类无效');
        }
      } else if (!['chars', 'actions', 'env'].includes(tabId)) {
        throw new Error('分组类型无效');
      }

      const groupTable = findPromptGroupTable(tabId);
      const groupExists = db.prepare(`SELECT owner_user_id FROM ${groupTable} WHERE id = ?`).get(groupId);
      if (!groupExists) {
        throw new Error(tabId === 'outfit' ? '未找到所属风格或分类' : '未找到分组');
      }
      ensureCanManageOwner(actor, groupExists.owner_user_id);

      db.prepare('INSERT INTO prompts(id, owner_user_id, section, group_id, category_key, name, prompt) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(newId(), groupExists.owner_user_id, tabId, groupId, categoryKey, name, prompt);
      return '已新增提示词条目';
    }

    if (action === 'renameOutfitGroup') {
      const groupId = requireString(payload.groupId, '服装风格不存在');
      const title = requireString(payload.title, '风格名称不能为空');
      const existed = db.prepare('SELECT owner_user_id FROM outfits WHERE id = ?').get(groupId);
      if (!existed) {
        throw new Error('服装风格不存在');
      }
      ensureCanManageOwner(actor, existed.owner_user_id);
      const duplicated = db.prepare('SELECT 1 FROM outfits WHERE owner_user_id = ? AND title = ? AND id <> ?').get(existed.owner_user_id, title, groupId);
      if (duplicated) {
        throw new Error('风格名称已存在');
      }
      db.prepare('UPDATE outfits SET title = ? WHERE owner_user_id = ? AND id = ?').run(title, existed.owner_user_id, groupId);
      return '风格名称已更新';
    }

    if (action === 'deleteOutfitGroup') {
      const groupId = requireString(payload.groupId, '服装风格不存在');
      const existed = db.prepare('SELECT owner_user_id FROM outfits WHERE id = ?').get(groupId);
      if (!existed) {
        throw new Error('服装风格不存在');
      }
      ensureCanManageOwner(actor, existed.owner_user_id);
      db.prepare("DELETE FROM prompts WHERE owner_user_id = ? AND section = 'outfit' AND group_id = ?").run(existed.owner_user_id, groupId);
      db.prepare('DELETE FROM outfits WHERE owner_user_id = ? AND id = ?').run(existed.owner_user_id, groupId);
      return '服装风格已删除';
    }

    if (action === 'deleteOutfitItem') {
      const groupId = requireString(payload.groupId, '未找到所属风格或分类');
      const categoryKey = requireString(payload.categoryKey, '服装分类无效');
      const itemId = requireString(payload.itemId, '条目不存在，无法删除');
      if (!OUTFIT_CATEGORY_KEYS.includes(categoryKey)) {
        throw new Error('服装分类无效');
      }
      const existed = db.prepare("SELECT owner_user_id FROM prompts WHERE id = ? AND section = 'outfit' AND group_id = ? AND category_key = ?")
        .get(itemId, groupId, categoryKey);
      if (!existed) {
        throw new Error('条目不存在，无法删除');
      }
      ensureCanManageOwner(actor, existed.owner_user_id);
      const removed = db.prepare("DELETE FROM prompts WHERE owner_user_id = ? AND id = ? AND section = 'outfit' AND group_id = ? AND category_key = ?")
        .run(existed.owner_user_id, itemId, groupId, categoryKey);
      if (!removed.changes) {
        throw new Error('条目不存在，无法删除');
      }
      return '条目已删除';
    }

    throw new Error('未知操作类型');
  });

  return tx();
}

function getGithubAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_CALLBACK_URL,
    scope: 'read:user user:email',
    state
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

function createOAuthState(redirectPath) {
  const pathValue = String(redirectPath || '/').trim();
  const safePath = pathValue.startsWith('/') ? pathValue : '/';
  const state = crypto.randomBytes(24).toString('hex');
  const expiresAt = nowMs() + 10 * 60 * 1000;
  db.prepare('INSERT INTO oauth_states(state, redirect_path, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(state, safePath, expiresAt, nowMs());
  db.prepare('DELETE FROM oauth_states WHERE expires_at <= ?').run(nowMs());
  return state;
}

function consumeOAuthState(state) {
  const stateValue = String(state || '').trim();
  if (!stateValue) {
    throw new Error('state 参数缺失');
  }

  const row = db.prepare('SELECT state, redirect_path, expires_at FROM oauth_states WHERE state = ?').get(stateValue);
  db.prepare('DELETE FROM oauth_states WHERE state = ?').run(stateValue);

  if (!row) {
    throw new Error('state 无效');
  }

  if (Number(row.expires_at) <= nowMs()) {
    throw new Error('state 已过期');
  }

  return row.redirect_path || '/';
}

async function exchangeGithubCode(code, state) {
  const body = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    client_secret: GITHUB_CLIENT_SECRET,
    code,
    redirect_uri: GITHUB_CALLBACK_URL,
    state
  });

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error('GitHub token 交换失败');
  }

  const result = await response.json();
  if (!result || !result.access_token) {
    throw new Error('GitHub token 交换失败');
  }

  return result.access_token;
}

async function fetchGithubUser(accessToken) {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'SD-OutfitHub'
    }
  });

  if (!response.ok) {
    throw new Error('获取 GitHub 用户信息失败');
  }

  const user = await response.json();
  if (!user || !user.id || !user.login) {
    throw new Error('GitHub 用户信息无效');
  }

  return {
    providerUserId: String(user.id),
    username: String(user.login)
  };
}

function upsertGithubUser(profile) {
  const existing = db.prepare('SELECT id, username, display_name FROM users WHERE provider = ? AND provider_user_id = ?')
    .get('github', profile.providerUserId);

  if (existing) {
    db.prepare('UPDATE users SET username = ? WHERE id = ?')
      .run(profile.username, existing.id);
    const nickname = optionalTrimmedString(existing.display_name) || profile.username;
    return { id: existing.id, username: profile.username, nickname };
  }

  const hasSameUsername = db.prepare('SELECT 1 FROM users WHERE username = ?').get(profile.username);
  const safeUsername = hasSameUsername ? `${profile.username}-${profile.providerUserId}` : profile.username;
  const userId = newId();
  const userCount = db.prepare('SELECT COUNT(*) AS total FROM users').get();

  db.prepare('INSERT INTO users(id, username, display_name, password_hash, provider, provider_user_id, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(userId, safeUsername, safeUsername, '', 'github', profile.providerUserId, '', nowMs());

  if (userCount && Number(userCount.total) === 0) {
    adoptOrphanData(db, userId);
  }

  return { id: userId, username: safeUsername, nickname: safeUsername };
}

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(ROOT_DIR, { index: false }));

app.post('/api/auth/register', (req, res) => {
  res.status(410).json({ message: '已禁用本地注册，请使用 GitHub 登录' });
});

app.post('/api/auth/login', (req, res) => {
  res.status(410).json({ message: '已禁用本地登录，请使用 GitHub 登录' });
});

app.get('/api/auth/github/start', (req, res) => {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    res.status(500).json({ message: 'GitHub OAuth 未配置：请设置 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET' });
    return;
  }

  const redirectPath = String(req.query.redirect || '/').trim();
  const state = createOAuthState(redirectPath);
  res.redirect(getGithubAuthorizeUrl(state));
});

app.get('/api/auth/github/callback', async (req, res) => {
  try {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      res.status(500).send('GitHub OAuth not configured');
      return;
    }

    const code = requireString(req.query.code, '缺少 code 参数');
    const state = requireString(req.query.state, '缺少 state 参数');
    const redirectPath = consumeOAuthState(state);

    const githubAccessToken = await exchangeGithubCode(code, state);
    const profile = await fetchGithubUser(githubAccessToken);
    const user = upsertGithubUser(profile);
    const tokens = issueTokens(user);

    const hash = new URLSearchParams({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken
    }).toString();

    res.redirect(`${redirectPath}#${hash}`);
  } catch (error) {
    res.status(400).send(error.message || 'GitHub 登录失败');
  }
});

app.post('/api/auth/refresh', (req, res) => {
  try {
    const refreshToken = requireString(req.body && req.body.refreshToken, '缺少 refresh token');
    const tokens = rotateRefreshToken(refreshToken);
    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (error) {
    res.status(401).json({ message: error.message || '刷新失败' });
  }
});

app.get('/api/auth/me', authOptional, (req, res) => {
  if (!req.user && req.authError) {
    res.status(401).json({ message: req.authError });
    return;
  }

  if (!req.user) {
    res.json({ authenticated: false, username: '', nickname: '', isAdmin: false });
    return;
  }

  res.json({
    authenticated: true,
    userId: req.user.id,
    username: req.user.username,
    nickname: req.user.nickname || req.user.username,
    isAdmin: !!req.user.isAdmin
  });
});

app.put('/api/auth/profile', authRequired, (req, res) => {
  try {
    const nicknameRaw = req.body && Object.prototype.hasOwnProperty.call(req.body, 'nickname')
      ? optionalTrimmedString(req.body.nickname)
      : req.user.nickname;

    if (!nicknameRaw) {
      res.status(400).json({ message: '昵称不能为空' });
      return;
    }

    db.prepare('UPDATE users SET display_name = ? WHERE id = ?')
      .run(nicknameRaw, req.user.id);

    res.json({
      message: '资料已更新',
      profile: {
        userId: req.user.id,
        username: req.user.username,
        nickname: nicknameRaw,
        isAdmin: !!req.user.isAdmin
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message || '资料更新失败' });
  }
});

app.post('/api/auth/activate-admin', authRequired, (req, res) => {
  try {
    if (!ADMIN_ACTIVATION_CODE) {
      res.status(503).json({ message: '服务端未配置管理员激活码' });
      return;
    }

    const code = requireString(req.body && req.body.code, '请输入激活码');
    if (code !== ADMIN_ACTIVATION_CODE) {
      res.status(400).json({ message: '激活码无效' });
      return;
    }

    const updated = db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(req.user.id);
    if (!updated.changes) {
      res.status(404).json({ message: '用户不存在' });
      return;
    }

    res.json({ message: '管理员权限已激活', isAdmin: true });
  } catch (error) {
    res.status(400).json({ message: error.message || '激活失败' });
  }
});

app.get('/api/prompts', authOptional, (req, res) => {
  try {
    if (!req.user && req.authError) {
      res.status(401).json({ message: req.authError });
      return;
    }

    res.set('Cache-Control', 'no-store');
    const isReadOnly = !req.user;
    res.set('X-Read-Only', isReadOnly ? '1' : '0');
    res.set('X-Is-Admin', req.user && req.user.isAdmin ? '1' : '0');
    res.set('X-User-Id', req.user ? req.user.id : '');
    res.set('X-User-Name', req.user ? req.user.username : '');
    res.set('X-User-Nickname', req.user ? (req.user.nickname || req.user.username) : '');
    res.json(getMergedPromptDataSnapshot());
  } catch (error) {
    res.status(500).json({ message: '读取数据失败', detail: error.message });
  }
});

app.get('/api/prompts/export', authOptional, (req, res) => {
  try {
    if (!req.user && req.authError) {
      res.status(401).json({ message: req.authError });
      return;
    }

    const isReadOnly = !req.user;
    const data = getMergedPromptDataSnapshot();

    res.set('Cache-Control', 'no-store');
    res.set('X-Read-Only', isReadOnly ? '1' : '0');
    res.set('X-Is-Admin', req.user && req.user.isAdmin ? '1' : '0');
    res.set('X-User-Id', req.user ? req.user.id : '');
    res.set('X-User-Name', req.user ? req.user.username : '');
    res.set('X-User-Nickname', req.user ? (req.user.nickname || req.user.username) : '');
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="prompt-data.json"');
    res.send(JSON.stringify(data, null, 2));
  } catch (error) {
    res.status(500).json({ message: '导出数据失败', detail: error.message });
  }
});

app.put('/api/prompts', authRequired, ensureAdmin, (req, res) => {
  try {
    const parsed = req.body;
    if (!parsed || typeof parsed !== 'object') {
      res.status(400).json({ message: '数据格式错误' });
      return;
    }

    const normalized = normalizePromptData(parsed);
    replaceAllData(db, normalized, req.user.id);
    res.json({ message: '保存成功', data: getMergedPromptDataSnapshot() });
  } catch (error) {
    res.status(400).json({ message: '无法解析 JSON', detail: error.message });
  }
});

app.post('/api/prompts/mutate', authRequired, (req, res) => {
  try {
    const action = String(req.body && req.body.action || '');
    const payload = req.body && req.body.payload ? req.body.payload : {};
    if (!action) {
      res.status(400).json({ message: '缺少 action 参数' });
      return;
    }

    const message = mutateByAction(req.user, action, payload);
    res.json({ message: message || '操作成功', data: getMergedPromptDataSnapshot() });
  } catch (error) {
    res.status(400).json({ message: error.message || '操作失败' });
  }
});

app.get('/api/characters', authRequired, (req, res) => {
  try {
    const chars = getCharacters(db, req.user.id);
    res.set('Cache-Control', 'no-store');
    res.json({ total: chars.length, chars });
  } catch (error) {
    res.status(500).json({ message: '读取角色列表失败', detail: error.message });
  }
});

app.post('/api/characters', authRequired, (req, res) => {
  try {
    const title = requireString(req.body && req.body.title, '请输入角色分组名称');
    const tags = Array.isArray(req.body && req.body.tags) ? req.body.tags : [];
    const existed = db.prepare('SELECT 1 FROM characters WHERE owner_user_id = ? AND title = ?').get(req.user.id, title);
    if (existed) {
      res.status(400).json({ message: '该角色分组已存在' });
      return;
    }

    const id = newId();
    db.prepare('INSERT INTO characters(id, owner_user_id, title, tags_json) VALUES (?, ?, ?, ?)').run(id, req.user.id, title, JSON.stringify(tags));
    res.status(201).json({ id, title, tags });
  } catch (error) {
    res.status(400).json({ message: error.message || '创建角色失败' });
  }
});

app.put('/api/characters/:id', authRequired, (req, res) => {
  try {
    const id = requireString(req.params.id, '角色分组不存在');
    const existing = db.prepare('SELECT id, title, tags_json FROM characters WHERE owner_user_id = ? AND id = ?').get(req.user.id, id);
    if (!existing) {
      res.status(404).json({ message: '角色分组不存在' });
      return;
    }

    const nextTitle = (req.body && Object.prototype.hasOwnProperty.call(req.body, 'title'))
      ? requireString(req.body.title, '角色名称不能为空')
      : existing.title;
    const nextTags = (req.body && Object.prototype.hasOwnProperty.call(req.body, 'tags'))
      ? (Array.isArray(req.body.tags) ? req.body.tags : [])
      : JSON.parse(existing.tags_json || '[]');

    const duplicated = db.prepare('SELECT 1 FROM characters WHERE owner_user_id = ? AND title = ? AND id <> ?').get(req.user.id, nextTitle, id);
    if (duplicated) {
      res.status(400).json({ message: '角色名称已存在' });
      return;
    }

    db.prepare('UPDATE characters SET title = ?, tags_json = ? WHERE owner_user_id = ? AND id = ?').run(nextTitle, JSON.stringify(nextTags), req.user.id, id);
    res.json({ id, title: nextTitle, tags: nextTags });
  } catch (error) {
    res.status(400).json({ message: error.message || '更新角色失败' });
  }
});

app.delete('/api/characters/:id', authRequired, (req, res) => {
  try {
    const id = requireString(req.params.id, '角色分组不存在');
    const existed = db.prepare('SELECT 1 FROM characters WHERE owner_user_id = ? AND id = ?').get(req.user.id, id);
    if (!existed) {
      res.status(404).json({ message: '角色分组不存在' });
      return;
    }

    const tx = db.transaction(() => {
      db.prepare("DELETE FROM prompts WHERE owner_user_id = ? AND section = 'chars' AND group_id = ?").run(req.user.id, id);
      db.prepare('DELETE FROM characters WHERE owner_user_id = ? AND id = ?').run(req.user.id, id);
    });

    tx();
    res.json({ message: '角色已删除' });
  } catch (error) {
    res.status(400).json({ message: error.message || '删除角色失败' });
  }
});

app.get('/api/agent-skill/search', authRequired, (req, res) => {
  const keyword = req.query.keyword || req.query.q || '';
  const limit = req.query.limit || '10';
  const section = req.query.section || '';

  if (!String(keyword).trim()) {
    res.status(400).json({ message: '缺少关键词参数，请提供 keyword 或 q' });
    return;
  }

  try {
    const results = searchPromptDatabase(db, req.user.id, keyword, { limit, section });
    res.json({
      skill: 'prompt-search',
      query: String(keyword),
      section: section || 'all',
      total: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({ message: '检索失败', detail: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log('SD-OutfitHub server is running at http://localhost:' + PORT);
});
