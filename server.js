const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, 'data.json');
const LEGACY_DATA_FILE = path.join(ROOT_DIR, 'prompt-data.json');
const OUTFIT_CATEGORY_KEYS = ['tops', 'bottoms', 'shoes', 'headwear', 'accessories', 'weapons', 'others'];

function readDataFile() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeDataFile(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

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

function normalizeData(data) {
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

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s_\-]+/g, '')
    .trim();
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

function searchPromptDatabase(data, keyword, options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit) || 10, 100));
  const sectionFilter = options.section ? String(options.section).trim() : '';
  const normalizedKeyword = normalizeText(keyword);

  if (!normalizedKeyword) {
    return [];
  }

  const sections = ['chars', 'actions', 'env', 'outfit'];
  const targetSections = sectionFilter && sections.includes(sectionFilter)
    ? [sectionFilter]
    : sections;

  const results = [];

  for (const section of targetSections) {
    const groups = Array.isArray(data[section]) ? data[section] : [];

    for (const group of groups) {
      const groupId = group.id || '';
      const groupTitle = group.title || '';
      const groupTags = Array.isArray(group.tags) ? group.tags : [];
      const items = [];

      if (section === 'outfit') {
        for (const categoryKey of OUTFIT_CATEGORY_KEYS) {
          const categoryItems = Array.isArray(group[categoryKey]) ? group[categoryKey] : [];
          for (const item of categoryItems) {
            items.push({ ...item, categoryKey });
          }
        }
      } else {
        const groupItems = Array.isArray(group.items) ? group.items : [];
        for (const item of groupItems) {
          items.push(item);
        }
      }

      for (const item of items) {
        const itemId = item.id || '';
        const itemName = item.name || '';
        const prompt = item.prompt || '';
        const categoryKey = item.categoryKey || '';
        const matchedFields = [];
        let totalScore = 0;

        const nameScore = scoreField(keyword, normalizedKeyword, itemName);
        if (nameScore > 0) {
          matchedFields.push('item.name');
          totalScore += nameScore + 30;
        }

        const titleScore = scoreField(keyword, normalizedKeyword, groupTitle);
        if (titleScore > 0) {
          matchedFields.push('group.title');
          totalScore += titleScore + 20;
        }

        if (section === 'outfit' && categoryKey) {
          const categoryLabelMap = {
            tops: '上衣',
            bottoms: '下装',
            shoes: '鞋子',
            headwear: '头饰',
            accessories: '配件',
            weapons: '武器',
            others: '其他'
          };
          const categoryLabel = categoryLabelMap[categoryKey] || categoryKey;
          const categoryScore = scoreField(keyword, normalizedKeyword, categoryLabel);
          if (categoryScore > 0) {
            matchedFields.push('outfit.category');
            totalScore += categoryScore + 10;
          }
        }

        const tagScore = groupTags.reduce((best, tag) => Math.max(best, scoreField(keyword, normalizedKeyword, tag)), 0);
        if (tagScore > 0) {
          matchedFields.push('group.tags');
          totalScore += tagScore + 15;
        }

        const promptScore = scoreField(keyword, normalizedKeyword, prompt);
        if (promptScore > 0) {
          matchedFields.push('item.prompt');
          totalScore += promptScore;
        }

        if (totalScore > 0) {
          results.push({
            section,
            groupId,
            groupTitle,
            itemId,
            itemName,
            prompt,
            categoryKey,
            tags: groupTags,
            score: totalScore,
            matchedFields
          });
        }
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

function findGroup(data, tabId, groupId) {
  const groups = Array.isArray(data[tabId]) ? data[tabId] : [];
  return groups.find(group => group.id === groupId) || null;
}

function mutateData(originalData, action, payload = {}) {
  const data = normalizeData(originalData);

  if (action === 'addCharGroup') {
    const title = String(payload.title || '').trim();
    if (!title) {
      throw new Error('请输入角色分组名称');
    }
    const existed = data.chars.some(group => group.title === title);
    if (existed) {
      throw new Error('该角色分组已存在');
    }
    data.chars.unshift({ id: newId(), title, tags: [], items: [] });
    return { data, message: '已新增角色分组' };
  }

  if (action === 'addOutfitGroup') {
    const title = String(payload.title || '').trim();
    if (!title) {
      throw new Error('请输入服装风格名称');
    }
    const existed = data.outfit.some(group => group.title === title);
    if (existed) {
      throw new Error('该服装风格已存在');
    }
    data.outfit.unshift({ id: newId(), title, tops: [], bottoms: [], shoes: [], headwear: [], accessories: [], weapons: [], others: [] });
    return { data, message: '已新增服装风格' };
  }

  if (action === 'editCharGroupTags') {
    const groupId = String(payload.groupId || '');
    const group = findGroup(data, 'chars', groupId);
    if (!group) {
      throw new Error('角色分组不存在');
    }
    const tags = Array.isArray(payload.tags) ? parseTags(payload.tags.join(',')) : parseTags(payload.tagsRaw || '');
    group.tags = tags;
    return { data, message: '角色标签已更新' };
  }

  if (action === 'addCharTag') {
    const group = findGroup(data, 'chars', String(payload.groupId || ''));
    if (!group) {
      throw new Error('角色分组不存在');
    }
    if (!Array.isArray(group.tags)) {
      group.tags = [];
    }
    const tag = String(payload.tag || '').trim();
    if (!tag) {
      throw new Error('标签不能为空');
    }
    if (group.tags.includes(tag)) {
      throw new Error('该标签已存在');
    }
    group.tags.push(tag);
    return { data, message: '标签已添加' };
  }

  if (action === 'editCharTag') {
    const group = findGroup(data, 'chars', String(payload.groupId || ''));
    if (!group) {
      throw new Error('角色分组不存在');
    }
    const oldTag = String(payload.oldTag || '');
    const nextTag = String(payload.nextTag || '').trim();
    if (!nextTag) {
      throw new Error('标签不能为空');
    }
    if (!Array.isArray(group.tags)) {
      group.tags = [];
    }
    const oldIndex = group.tags.indexOf(oldTag);
    if (oldIndex < 0) {
      throw new Error('标签不存在');
    }
    if (oldTag !== nextTag && group.tags.includes(nextTag)) {
      throw new Error('该标签已存在');
    }
    group.tags[oldIndex] = nextTag;
    return { data, message: '标签已更新' };
  }

  if (action === 'deleteCharTag') {
    const group = findGroup(data, 'chars', String(payload.groupId || ''));
    if (!group) {
      throw new Error('角色分组不存在');
    }
    const oldTag = String(payload.tag || '');
    if (!Array.isArray(group.tags) || !group.tags.includes(oldTag)) {
      throw new Error('标签不存在');
    }
    group.tags = group.tags.filter(tag => tag !== oldTag);
    return { data, message: '标签已删除' };
  }

  if (action === 'renameCharGroup') {
    const groupId = String(payload.groupId || '');
    const group = findGroup(data, 'chars', groupId);
    if (!group) {
      throw new Error('角色分组不存在');
    }
    const title = String(payload.title || '').trim();
    if (!title) {
      throw new Error('角色名称不能为空');
    }
    const duplicated = data.chars.some(item => item.id !== groupId && item.title === title);
    if (duplicated) {
      throw new Error('角色名称已存在');
    }
    group.title = title;
    return { data, message: '角色名称已更新' };
  }

  if (action === 'deleteCharGroup') {
    const groupId = String(payload.groupId || '');
    const existed = data.chars.some(group => group.id === groupId);
    if (!existed) {
      throw new Error('角色分组不存在');
    }
    data.chars = data.chars.filter(group => group.id !== groupId);
    return { data, message: '角色已删除' };
  }

  if (action === 'deleteItem') {
    const tabId = String(payload.tabId || '');
    if (!['chars', 'actions', 'env'].includes(tabId)) {
      throw new Error('分组类型无效');
    }
    const group = findGroup(data, tabId, String(payload.groupId || ''));
    if (!group) {
      throw new Error('未找到所属分组');
    }
    const beforeCount = group.items.length;
    group.items = group.items.filter(item => item.id !== String(payload.itemId || ''));
    if (beforeCount === group.items.length) {
      throw new Error('条目不存在，无法删除');
    }
    return { data, message: '条目已删除' };
  }

  if (action === 'saveItem') {
    const tabId = String(payload.tabId || '');
    const groupId = String(payload.groupId || '');
    const itemId = String(payload.itemId || '');
    const categoryKey = String(payload.categoryKey || '');
    const name = String(payload.name || '').trim();
    const prompt = String(payload.prompt || '').trim();

    if (!name || !prompt) {
      throw new Error('请填写完整信息');
    }

    if (tabId === 'outfit') {
      if (!OUTFIT_CATEGORY_KEYS.includes(categoryKey)) {
        throw new Error('服装分类无效');
      }
      const group = findGroup(data, 'outfit', groupId);
      if (!group || !Array.isArray(group[categoryKey])) {
        throw new Error('未找到所属风格或分类');
      }
      const target = group[categoryKey].find(item => item.id === itemId);
      if (!target) {
        throw new Error('条目不存在，可能已被删除');
      }
      target.name = name;
      target.prompt = prompt;
    } else {
      if (!['chars', 'actions', 'env'].includes(tabId)) {
        throw new Error('分组类型无效');
      }
      const group = findGroup(data, tabId, groupId);
      if (!group) {
        throw new Error('未找到所属分组');
      }
      const target = group.items.find(item => item.id === itemId);
      if (!target) {
        throw new Error('条目不存在，可能已被删除');
      }
      target.name = name;
      target.prompt = prompt;
    }

    return { data, message: '提示词已更新' };
  }

  if (action === 'addItem') {
    const tabId = String(payload.tabId || '');
    const groupId = String(payload.groupId || '');
    const categoryKey = String(payload.categoryKey || '');
    const name = String(payload.name || '').trim();
    const prompt = String(payload.prompt || '').trim();

    if (!name || !prompt) {
      throw new Error('请填写完整信息');
    }

    if (tabId === 'outfit') {
      if (!OUTFIT_CATEGORY_KEYS.includes(categoryKey)) {
        throw new Error('服装分类无效');
      }
      const group = findGroup(data, 'outfit', groupId);
      if (!group || !Array.isArray(group[categoryKey])) {
        throw new Error('未找到所属风格或分类');
      }
      group[categoryKey].unshift({ id: newId(), name, prompt });
    } else {
      if (!['chars', 'actions', 'env'].includes(tabId)) {
        throw new Error('分组类型无效');
      }
      const group = findGroup(data, tabId, groupId);
      if (!group) {
        throw new Error('未找到分组');
      }
      group.items.unshift({ id: newId(), name, prompt });
    }

    return { data, message: '已新增提示词条目' };
  }

  if (action === 'renameOutfitGroup') {
    const groupId = String(payload.groupId || '');
    const group = findGroup(data, 'outfit', groupId);
    if (!group) {
      throw new Error('服装风格不存在');
    }
    const title = String(payload.title || '').trim();
    if (!title) {
      throw new Error('风格名称不能为空');
    }
    const duplicated = data.outfit.some(item => item.id !== groupId && item.title === title);
    if (duplicated) {
      throw new Error('风格名称已存在');
    }
    group.title = title;
    return { data, message: '风格名称已更新' };
  }

  if (action === 'deleteOutfitGroup') {
    const groupId = String(payload.groupId || '');
    const existed = data.outfit.some(group => group.id === groupId);
    if (!existed) {
      throw new Error('服装风格不存在');
    }
    data.outfit = data.outfit.filter(group => group.id !== groupId);
    return { data, message: '服装风格已删除' };
  }

  if (action === 'deleteOutfitItem') {
    const group = findGroup(data, 'outfit', String(payload.groupId || ''));
    const categoryKey = String(payload.categoryKey || '');
    if (!group || !OUTFIT_CATEGORY_KEYS.includes(categoryKey) || !Array.isArray(group[categoryKey])) {
      throw new Error('未找到所属风格或分类');
    }
    const beforeCount = group[categoryKey].length;
    group[categoryKey] = group[categoryKey].filter(item => item.id !== String(payload.itemId || ''));
    if (beforeCount === group[categoryKey].length) {
      throw new Error('条目不存在，无法删除');
    }
    return { data, message: '条目已删除' };
  }

  throw new Error('未知操作类型');
}

function ensureDataFile() {
  if (fs.existsSync(DATA_FILE)) {
    return;
  }

  if (fs.existsSync(LEGACY_DATA_FILE)) {
    try {
      const legacyRaw = fs.readFileSync(LEGACY_DATA_FILE, 'utf8');
      const legacyData = JSON.parse(legacyRaw);
      writeDataFile(normalizeData(legacyData));
      return;
    } catch (error) {
      console.warn('legacy prompt-data.json 迁移失败，已创建空 data.json', error.message);
    }
  }

  writeDataFile({ chars: [], actions: [], env: [], outfit: [] });
}

ensureDataFile();

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(ROOT_DIR, { index: false }));

app.get('/api/prompts', (req, res) => {
  try {
    const data = normalizeData(readDataFile());
    res.set('Cache-Control', 'no-store');
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: '读取数据失败', detail: error.message });
  }
});

app.get('/api/chars', (req, res) => {
  try {
    const data = normalizeData(readDataFile());
    const chars = Array.isArray(data.chars) ? data.chars : [];
    const result = chars.map(group => ({
      id: group.id || '',
      title: group.title || '',
      tags: Array.isArray(group.tags) ? group.tags : [],
      itemCount: Array.isArray(group.items) ? group.items.length : 0
    }));

    res.set('Cache-Control', 'no-store');
    res.json({ total: result.length, chars: result });
  } catch (error) {
    res.status(500).json({ message: '读取角色列表失败', detail: error.message });
  }
});

app.put('/api/prompts', (req, res) => {
  try {
    const parsed = req.body;
    if (!parsed || typeof parsed !== 'object') {
      res.status(400).json({ message: '数据格式错误' });
      return;
    }

    const normalized = normalizeData(parsed);
    writeDataFile(normalized);
    res.json({ message: '保存成功', data: normalized });
  } catch (error) {
    res.status(400).json({ message: '无法解析 JSON', detail: error.message });
  }
});

app.post('/api/prompts/mutate', (req, res) => {
  try {
    const action = String(req.body && req.body.action || '');
    const payload = req.body && req.body.payload ? req.body.payload : {};
    if (!action) {
      res.status(400).json({ message: '缺少 action 参数' });
      return;
    }

    const current = readDataFile();
    const mutated = mutateData(current, action, payload);
    const normalized = normalizeData(mutated.data);
    writeDataFile(normalized);
    res.json({ message: mutated.message || '操作成功', data: normalized });
  } catch (error) {
    res.status(400).json({ message: error.message || '操作失败' });
  }
});

app.get('/api/agent-skill/search', (req, res) => {
  const keyword = req.query.keyword || req.query.q || '';
  const limit = req.query.limit || '10';
  const section = req.query.section || '';

  if (!String(keyword).trim()) {
    res.status(400).json({ message: '缺少关键词参数，请提供 keyword 或 q' });
    return;
  }

  try {
    const data = readDataFile();
    const results = searchPromptDatabase(data, keyword, { limit, section });
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
