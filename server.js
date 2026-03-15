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

function handleApi(req, res) {
  if (req.url !== '/api/prompts') {
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
    '.json': 'application/json; charset=utf-8'
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
  console.log(`Prompt factory server is running at http://localhost:${PORT}`);
});
