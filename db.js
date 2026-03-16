const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_FILE = path.join(__dirname, 'data.sqlite');
const JSON_DATA_FILE = path.join(__dirname, 'data.json');
const LEGACY_JSON_DATA_FILE = path.join(__dirname, 'prompt-data.json');
const OUTFIT_CATEGORY_KEYS = ['tops', 'bottoms', 'shoes', 'headwear', 'accessories', 'weapons', 'others'];

function newId() {
  return 'id-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
}

function deepClone(data) {
  return JSON.parse(JSON.stringify(data));
}

function parseTags(value) {
  const parts = String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  const uniq = [];
  const seen = new Set();
  parts.forEach(tag => {
    if (!seen.has(tag)) {
      seen.add(tag);
      uniq.push(tag);
    }
  });

  return uniq;
}

function normalizePromptData(data) {
  const normalized = deepClone(data || {});
  ['chars', 'actions', 'env', 'outfit'].forEach(key => {
    if (!Array.isArray(normalized[key])) {
      normalized[key] = [];
    }
  });

  ['chars', 'actions', 'env'].forEach(tabKey => {
    normalized[tabKey] = normalized[tabKey].map(group => {
      const nextGroup = group && typeof group === 'object' ? deepClone(group) : { id: newId(), title: '未命名分组', items: [] };
      if (!Array.isArray(nextGroup.items)) {
        nextGroup.items = [];
      }
      return nextGroup;
    });
  });

  normalized.chars = normalized.chars.map(group => {
    const nextGroup = group && typeof group === 'object' ? deepClone(group) : { id: newId(), title: '未命名角色', items: [], tags: [] };
    if (!Array.isArray(nextGroup.items)) {
      nextGroup.items = [];
    }
    if (!Array.isArray(nextGroup.tags)) {
      nextGroup.tags = [];
    }
    return nextGroup;
  });

  normalized.outfit = normalized.outfit.map(group => {
    const nextGroup = group && typeof group === 'object' ? deepClone(group) : { id: newId(), title: '未命名风格' };
    OUTFIT_CATEGORY_KEYS.forEach(categoryKey => {
      if (!Array.isArray(nextGroup[categoryKey])) {
        nextGroup[categoryKey] = [];
      }
    });
    return nextGroup;
  });

  return normalized;
}

function ensureColumn(db, tableName, columnName, columnDef) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const existed = columns.some(column => column.name === columnName);
  if (!existed) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDef}`);
  }
}

function openDatabase() {
  const db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = OFF');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'local',
      provider_user_id TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS oauth_states (
      state TEXT PRIMARY KEY,
      redirect_path TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      tags_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS outfits (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompt_groups (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL DEFAULT '',
      section TEXT NOT NULL CHECK(section IN ('actions', 'env')),
      title TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL DEFAULT '',
      section TEXT NOT NULL CHECK(section IN ('chars', 'actions', 'env', 'outfit')),
      group_id TEXT NOT NULL,
      category_key TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      prompt TEXT NOT NULL
    );
  `);

  ensureColumn(db, 'characters', 'owner_user_id', "owner_user_id TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'outfits', 'owner_user_id', "owner_user_id TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'prompt_groups', 'owner_user_id', "owner_user_id TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'prompts', 'owner_user_id', "owner_user_id TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'users', 'provider', "provider TEXT NOT NULL DEFAULT 'local'");
  ensureColumn(db, 'users', 'provider_user_id', "provider_user_id TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'users', 'display_name', "display_name TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'users', 'avatar_url', "avatar_url TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'users', 'is_admin', 'is_admin INTEGER NOT NULL DEFAULT 0');

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_provider_external ON users(provider, provider_user_id);
    CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);
    CREATE INDEX IF NOT EXISTS idx_refresh_user_id ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_characters_owner ON characters(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_outfits_owner ON outfits(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_prompt_groups_owner_section ON prompt_groups(owner_user_id, section);
    CREATE INDEX IF NOT EXISTS idx_prompts_owner_section_group ON prompts(owner_user_id, section, group_id);
    CREATE INDEX IF NOT EXISTS idx_prompts_owner_group ON prompts(owner_user_id, group_id);
  `);

  return db;
}

function adoptOrphanData(db, ownerUserId) {
  const owner = String(ownerUserId || '').trim();
  if (!owner) {
    return;
  }

  const tx = db.transaction(() => {
    db.prepare("UPDATE characters SET owner_user_id = ? WHERE owner_user_id = ''").run(owner);
    db.prepare("UPDATE outfits SET owner_user_id = ? WHERE owner_user_id = ''").run(owner);
    db.prepare("UPDATE prompt_groups SET owner_user_id = ? WHERE owner_user_id = ''").run(owner);
    db.prepare("UPDATE prompts SET owner_user_id = ? WHERE owner_user_id = ''").run(owner);
  });

  tx();
}

function replaceAllData(db, inputData, ownerUserId) {
  const owner = String(ownerUserId || '').trim();
  if (!owner) {
    throw new Error('缺少 owner_user_id');
  }

  const data = normalizePromptData(inputData);
  const insertCharacter = db.prepare('INSERT INTO characters(id, owner_user_id, title, tags_json) VALUES (?, ?, ?, ?)');
  const insertOutfit = db.prepare('INSERT INTO outfits(id, owner_user_id, title) VALUES (?, ?, ?)');
  const insertPromptGroup = db.prepare('INSERT INTO prompt_groups(id, owner_user_id, section, title) VALUES (?, ?, ?, ?)');
  const insertPrompt = db.prepare('INSERT INTO prompts(id, owner_user_id, section, group_id, category_key, name, prompt) VALUES (?, ?, ?, ?, ?, ?, ?)');

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM prompts WHERE owner_user_id = ?').run(owner);
    db.prepare('DELETE FROM prompt_groups WHERE owner_user_id = ?').run(owner);
    db.prepare('DELETE FROM outfits WHERE owner_user_id = ?').run(owner);
    db.prepare('DELETE FROM characters WHERE owner_user_id = ?').run(owner);

    data.chars.forEach(group => {
      const groupId = group.id || newId();
      insertCharacter.run(groupId, owner, group.title || '', JSON.stringify(Array.isArray(group.tags) ? group.tags : []));
      const items = Array.isArray(group.items) ? group.items : [];
      items.forEach(item => {
        insertPrompt.run(item.id || newId(), owner, 'chars', groupId, '', item.name || '', item.prompt || '');
      });
    });

    data.actions.forEach(group => {
      const groupId = group.id || newId();
      insertPromptGroup.run(groupId, owner, 'actions', group.title || '');
      const items = Array.isArray(group.items) ? group.items : [];
      items.forEach(item => {
        insertPrompt.run(item.id || newId(), owner, 'actions', groupId, '', item.name || '', item.prompt || '');
      });
    });

    data.env.forEach(group => {
      const groupId = group.id || newId();
      insertPromptGroup.run(groupId, owner, 'env', group.title || '');
      const items = Array.isArray(group.items) ? group.items : [];
      items.forEach(item => {
        insertPrompt.run(item.id || newId(), owner, 'env', groupId, '', item.name || '', item.prompt || '');
      });
    });

    data.outfit.forEach(group => {
      const groupId = group.id || newId();
      insertOutfit.run(groupId, owner, group.title || '');
      OUTFIT_CATEGORY_KEYS.forEach(categoryKey => {
        const items = Array.isArray(group[categoryKey]) ? group[categoryKey] : [];
        items.forEach(item => {
          insertPrompt.run(item.id || newId(), owner, 'outfit', groupId, categoryKey, item.name || '', item.prompt || '');
        });
      });
    });
  });

  tx();
}

function safeParseTagsJson(tagsJson) {
  try {
    const parsed = JSON.parse(tagsJson || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function resolveUploaderName(ownerUserId, uploader) {
  if (uploader) {
    return uploader;
  }
  return ownerUserId ? '未知用户' : '匿名用户';
}

function resolveUploaderAvatar(avatarUrl) {
  return String(avatarUrl || '').trim();
}

function getPromptData(db, ownerUserId, options = {}) {
  const owner = String(ownerUserId || '').trim();
  const includeAllOwners = !!options.includeAllOwners;
  const includeUploader = !!options.includeUploader;
  const ownerFilterSql = includeAllOwners ? '' : ' WHERE %TABLE%.owner_user_id = ?';
  const ownerParams = includeAllOwners ? [] : [owner];
  const uploaderSelect = includeUploader
    ? ", COALESCE(NULLIF(users.display_name, ''), users.username, '') AS uploader, COALESCE(users.avatar_url, '') AS uploader_avatar_url"
    : '';

  const characters = db.prepare(
    `SELECT characters.id, characters.owner_user_id, characters.title, characters.tags_json${uploaderSelect}
     FROM characters
     LEFT JOIN users ON users.id = characters.owner_user_id
     ${ownerFilterSql.replace('%TABLE%', 'characters')}
     ORDER BY characters.rowid ASC`
  ).all(...ownerParams);

  const actionsGroups = db.prepare(
    `SELECT prompt_groups.id, prompt_groups.owner_user_id, prompt_groups.title${uploaderSelect}
     FROM prompt_groups
     LEFT JOIN users ON users.id = prompt_groups.owner_user_id
     ${ownerFilterSql.replace('%TABLE%', 'prompt_groups')}${includeAllOwners ? " WHERE prompt_groups.section = 'actions'" : " AND prompt_groups.section = 'actions'"}
     ORDER BY prompt_groups.rowid ASC`
  ).all(...ownerParams);

  const envGroups = db.prepare(
    `SELECT prompt_groups.id, prompt_groups.owner_user_id, prompt_groups.title${uploaderSelect}
     FROM prompt_groups
     LEFT JOIN users ON users.id = prompt_groups.owner_user_id
     ${ownerFilterSql.replace('%TABLE%', 'prompt_groups')}${includeAllOwners ? " WHERE prompt_groups.section = 'env'" : " AND prompt_groups.section = 'env'"}
     ORDER BY prompt_groups.rowid ASC`
  ).all(...ownerParams);

  const outfits = db.prepare(
    `SELECT outfits.id, outfits.owner_user_id, outfits.title${uploaderSelect}
     FROM outfits
     LEFT JOIN users ON users.id = outfits.owner_user_id
     ${ownerFilterSql.replace('%TABLE%', 'outfits')}
     ORDER BY outfits.rowid ASC`
  ).all(...ownerParams);

  const prompts = db.prepare(
    `SELECT prompts.id, prompts.owner_user_id, prompts.section, prompts.group_id, prompts.category_key, prompts.name, prompts.prompt${uploaderSelect}
     FROM prompts
     LEFT JOIN users ON users.id = prompts.owner_user_id
     ${ownerFilterSql.replace('%TABLE%', 'prompts')}
     ORDER BY prompts.rowid ASC`
  ).all(...ownerParams);

  const charsById = new Map();
  const actionsById = new Map();
  const envById = new Map();
  const outfitById = new Map();

  const chars = characters.map(row => {
    const group = {
      id: row.id,
      ownerUserId: row.owner_user_id || '',
      title: row.title,
      tags: safeParseTagsJson(row.tags_json),
      items: []
    };
    if (includeUploader) {
      group.uploader = resolveUploaderName(group.ownerUserId, row.uploader);
      group.uploaderAvatarUrl = resolveUploaderAvatar(row.uploader_avatar_url);
    }
    charsById.set(row.id, group);
    return group;
  });

  const actions = actionsGroups.map(row => {
    const group = { id: row.id, ownerUserId: row.owner_user_id || '', title: row.title, items: [] };
    if (includeUploader) {
      group.uploader = resolveUploaderName(group.ownerUserId, row.uploader);
      group.uploaderAvatarUrl = resolveUploaderAvatar(row.uploader_avatar_url);
    }
    actionsById.set(row.id, group);
    return group;
  });

  const env = envGroups.map(row => {
    const group = { id: row.id, ownerUserId: row.owner_user_id || '', title: row.title, items: [] };
    if (includeUploader) {
      group.uploader = resolveUploaderName(group.ownerUserId, row.uploader);
      group.uploaderAvatarUrl = resolveUploaderAvatar(row.uploader_avatar_url);
    }
    envById.set(row.id, group);
    return group;
  });

  const outfit = outfits.map(row => {
    const group = {
      id: row.id,
      ownerUserId: row.owner_user_id || '',
      title: row.title,
      tops: [],
      bottoms: [],
      shoes: [],
      headwear: [],
      accessories: [],
      weapons: [],
      others: []
    };
    if (includeUploader) {
      group.uploader = resolveUploaderName(group.ownerUserId, row.uploader);
      group.uploaderAvatarUrl = resolveUploaderAvatar(row.uploader_avatar_url);
    }
    outfitById.set(row.id, group);
    return group;
  });

  prompts.forEach(row => {
    const item = {
      id: row.id,
      ownerUserId: row.owner_user_id || '',
      name: row.name,
      prompt: row.prompt
    };
    if (includeUploader) {
      item.uploader = resolveUploaderName(item.ownerUserId, row.uploader);
      item.uploaderAvatarUrl = resolveUploaderAvatar(row.uploader_avatar_url);
    }
    if (row.section === 'chars') {
      const group = charsById.get(row.group_id);
      if (group) {
        group.items.push(item);
      }
      return;
    }
    if (row.section === 'actions') {
      const group = actionsById.get(row.group_id);
      if (group) {
        group.items.push(item);
      }
      return;
    }
    if (row.section === 'env') {
      const group = envById.get(row.group_id);
      if (group) {
        group.items.push(item);
      }
      return;
    }
    if (row.section === 'outfit') {
      const group = outfitById.get(row.group_id);
      const categoryKey = OUTFIT_CATEGORY_KEYS.includes(row.category_key) ? row.category_key : 'others';
      if (group) {
        group[categoryKey].push(item);
      }
    }
  });

  return { chars, actions, env, outfit };
}

function getCharacters(db, ownerUserId) {
  const owner = String(ownerUserId || '').trim();
  if (!owner) {
    return [];
  }

  const rows = db.prepare('SELECT id, title, tags_json FROM characters WHERE owner_user_id = ? ORDER BY rowid ASC').all(owner);
  const countStmt = db.prepare("SELECT COUNT(*) AS total FROM prompts WHERE owner_user_id = ? AND section = 'chars' AND group_id = ?");
  return rows.map(row => {
    const itemCountRow = countStmt.get(owner, row.id);
    return {
      id: row.id,
      title: row.title,
      tags: safeParseTagsJson(row.tags_json),
      itemCount: itemCountRow ? itemCountRow.total : 0
    };
  });
}

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/[\s_\-]+/g, '').trim();
}

function isSubsequence(needle, haystack) {
  if (!needle || !haystack) {
    return false;
  }
  let i = 0;
  let j = 0;
  while (i < needle.length && j < haystack.length) {
    if (needle[i] === haystack[j]) {
      i += 1;
    }
    j += 1;
  }
  return i === needle.length;
}

function scoreField(rawKeyword, normalizedKeyword, value) {
  const raw = String(value || '');
  const normalized = normalizeText(raw);
  if (!raw || !normalized) {
    return 0;
  }
  const lowerRaw = raw.toLowerCase();
  const lowerKeyword = String(rawKeyword || '').toLowerCase().trim();
  if (normalized === normalizedKeyword) {
    return 120;
  }
  if (normalized.startsWith(normalizedKeyword)) {
    return 90;
  }
  if (normalized.includes(normalizedKeyword)) {
    return 70;
  }
  if (lowerKeyword && lowerRaw.includes(lowerKeyword)) {
    return 65;
  }
  if (isSubsequence(normalizedKeyword, normalized)) {
    return 40;
  }
  return 0;
}

function searchPromptDatabase(db, ownerUserId, keyword, options = {}) {
  const data = getPromptData(db, ownerUserId);
  const limit = Math.max(1, Math.min(Number(options.limit) || 10, 100));
  const sectionFilter = options.section ? String(options.section).trim() : '';
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) {
    return [];
  }

  const sections = ['chars', 'actions', 'env', 'outfit'];
  const targetSections = sectionFilter && sections.includes(sectionFilter) ? [sectionFilter] : sections;
  const results = [];

  targetSections.forEach(section => {
    const groups = Array.isArray(data[section]) ? data[section] : [];
    groups.forEach(group => {
      const groupTags = Array.isArray(group.tags) ? group.tags : [];

      if (section === 'outfit') {
        OUTFIT_CATEGORY_KEYS.forEach(categoryKey => {
          const items = Array.isArray(group[categoryKey]) ? group[categoryKey] : [];
          items.forEach(item => {
            const matchedFields = [];
            let totalScore = 0;

            const nameScore = scoreField(keyword, normalizedKeyword, item.name || '');
            if (nameScore > 0) {
              matchedFields.push('item.name');
              totalScore += nameScore + 30;
            }
            const titleScore = scoreField(keyword, normalizedKeyword, group.title || '');
            if (titleScore > 0) {
              matchedFields.push('group.title');
              totalScore += titleScore + 20;
            }
            const categoryLabelMap = { tops: '上衣', bottoms: '下装', shoes: '鞋子', headwear: '头饰', accessories: '配件', weapons: '武器', others: '其他' };
            const categoryLabel = categoryLabelMap[categoryKey] || categoryKey;
            const categoryScore = scoreField(keyword, normalizedKeyword, categoryLabel);
            if (categoryScore > 0) {
              matchedFields.push('outfit.category');
              totalScore += categoryScore + 10;
            }
            const promptScore = scoreField(keyword, normalizedKeyword, item.prompt || '');
            if (promptScore > 0) {
              matchedFields.push('item.prompt');
              totalScore += promptScore;
            }

            if (totalScore > 0) {
              results.push({ section, groupId: group.id, groupTitle: group.title, itemId: item.id, itemName: item.name, prompt: item.prompt, categoryKey, tags: groupTags, score: totalScore, matchedFields });
            }
          });
        });
        return;
      }

      const items = Array.isArray(group.items) ? group.items : [];
      items.forEach(item => {
        const matchedFields = [];
        let totalScore = 0;

        const nameScore = scoreField(keyword, normalizedKeyword, item.name || '');
        if (nameScore > 0) {
          matchedFields.push('item.name');
          totalScore += nameScore + 30;
        }
        const titleScore = scoreField(keyword, normalizedKeyword, group.title || '');
        if (titleScore > 0) {
          matchedFields.push('group.title');
          totalScore += titleScore + 20;
        }
        const tagScore = groupTags.reduce((best, tag) => Math.max(best, scoreField(keyword, normalizedKeyword, tag)), 0);
        if (tagScore > 0) {
          matchedFields.push('group.tags');
          totalScore += tagScore + 15;
        }
        const promptScore = scoreField(keyword, normalizedKeyword, item.prompt || '');
        if (promptScore > 0) {
          matchedFields.push('item.prompt');
          totalScore += promptScore;
        }

        if (totalScore > 0) {
          results.push({ section, groupId: group.id, groupTitle: group.title, itemId: item.id, itemName: item.name, prompt: item.prompt, categoryKey: '', tags: groupTags, score: totalScore, matchedFields });
        }
      });
    });
  });

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

function readJsonSourceFile() {
  const source = fs.existsSync(JSON_DATA_FILE)
    ? JSON_DATA_FILE
    : (fs.existsSync(LEGACY_JSON_DATA_FILE) ? LEGACY_JSON_DATA_FILE : null);

  if (!source) {
    throw new Error('未找到 data.json 或 prompt-data.json');
  }

  const raw = fs.readFileSync(source, 'utf8');
  return { source, data: JSON.parse(raw) };
}

module.exports = {
  DB_FILE,
  JSON_DATA_FILE,
  LEGACY_JSON_DATA_FILE,
  OUTFIT_CATEGORY_KEYS,
  newId,
  parseTags,
  normalizePromptData,
  openDatabase,
  adoptOrphanData,
  replaceAllData,
  getPromptData,
  getCharacters,
  searchPromptDatabase,
  readJsonSourceFile
};
