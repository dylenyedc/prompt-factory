const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, 'prompt-data.json');
const INDEX_FILE = path.join(ROOT_DIR, 'index.html');

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function readDataFile() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeDataFile(data) {
  const text = JSON.stringify(data, null, 2);
  fs.writeFileSync(DATA_FILE, text, 'utf8');
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

  const sections = ['chars', 'actions', 'env'];
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
      const items = Array.isArray(group.items) ? group.items : [];

      for (const item of items) {
        const itemId = item.id || '';
        const itemName = item.name || '';
        const prompt = item.prompt || '';
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

function handleAgentSkillSearch(req, res, parsedUrl) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { message: 'Method Not Allowed' });
    return;
  }

  const keyword = parsedUrl.searchParams.get('keyword') || parsedUrl.searchParams.get('q') || '';
  const limit = parsedUrl.searchParams.get('limit') || '10';
  const section = parsedUrl.searchParams.get('section') || '';

  if (!String(keyword).trim()) {
    sendJson(res, 400, { message: '缺少关键词参数，请提供 keyword 或 q' });
    return;
  }

  try {
    const data = readDataFile();
    const results = searchPromptDatabase(data, keyword, { limit, section });
    sendJson(res, 200, {
      skill: 'prompt-search',
      query: String(keyword),
      section: section || 'all',
      total: results.length,
      results
    });
  } catch (error) {
    sendJson(res, 500, { message: '检索失败', detail: error.message });
  }
}

function handleApi(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/api/agent-skill/search') {
    handleAgentSkillSearch(req, res, parsedUrl);
    return;
  }

  if (pathname !== '/api/prompts') {
    sendJson(res, 404, { message: 'Not Found' });
    return;
  }

  if (req.method === 'GET') {
    try {
      const data = readDataFile();
      sendJson(res, 200, data);
    } catch (error) {
      sendJson(res, 500, { message: '读取数据失败', detail: error.message });
    }
    return;
  }

  if (req.method === 'PUT') {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (!parsed || typeof parsed !== 'object') {
          sendJson(res, 400, { message: '数据格式错误' });
          return;
        }

        writeDataFile(parsed);
        sendJson(res, 200, { message: '保存成功' });
      } catch (error) {
        sendJson(res, 400, { message: '无法解析 JSON', detail: error.message });
      }
    });

    return;
  }

  sendJson(res, 405, { message: 'Method Not Allowed' });
}

function handleStatic(req, res) {
  const normalizedUrl = req.url === '/' ? '/index.html' : req.url;
  const safePath = path.normalize(normalizedUrl).replace(/^([.][.][/\\])+/, '');
  const target = path.join(ROOT_DIR, safePath);

  if (!target.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  let filePath = target;
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = INDEX_FILE;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
  };

  const contentType = mimeMap[ext] || 'text/plain; charset=utf-8';
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    writeDataFile({ chars: [], actions: [], env: [] });
  }
}

ensureDataFile();

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    handleApi(req, res);
    return;
  }

  handleStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`SD-OutfitHub server is running at http://localhost:${PORT}`);
});
