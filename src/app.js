'use strict';

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

const authRouter = require('./routes/auth');
const promptsRouter = require('./routes/prompts');
const searchRouter = require('./routes/search');

const app = express();

// Body parsing (limit to 5 MB)
app.use(express.json({ limit: '5mb' }));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// API routes
app.use('/api/auth', authRouter);
app.use('/api/me', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({ id: req.session.userId, email: req.session.email });
  }
  return res.status(401).json({ message: '未登录' });
});
app.use('/api/prompts', promptsRouter);
app.use('/api/agent-skill/search', searchRouter);

// Serve static frontend
const ROOT_DIR = path.join(__dirname, '..');
app.use(express.static(ROOT_DIR, {
  index: 'index.html',
  // Don't cache HTML to ensure fresh loads
  setHeaders: (res, filePath) => {
    if (path.extname(filePath) === '.html') {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

// SPA fallback – serve index.html for any non-API, non-asset route
app.use((req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

module.exports = app;
