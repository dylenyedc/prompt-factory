'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const prisma = require('../db');

const router = express.Router();
const BCRYPT_ROUNDS = 12;

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ message: '请提供有效的邮箱地址' });
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ message: '密码不能少于 8 位' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ message: '该邮箱已被注册' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { email: normalizedEmail, passwordHash }
    });

    req.session.userId = user.id;
    req.session.email = user.email;

    return res.status(201).json({ id: user.id, email: user.email });
  } catch (err) {
    console.error('register error', err);
    return res.status(500).json({ message: '注册失败，请稍后重试' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: '请提供邮箱和密码' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(401).json({ message: '邮箱或密码错误' });
    }

    const match = await bcrypt.compare(String(password), user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: '邮箱或密码错误' });
    }

    req.session.userId = user.id;
    req.session.email = user.email;

    return res.json({ id: user.id, email: user.email });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ message: '登录失败，请稍后重试' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ message: '退出失败' });
    }
    res.clearCookie('connect.sid');
    return res.json({ message: '已退出登录' });
  });
});

// GET /api/me
router.get('/me', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({ id: req.session.userId, email: req.session.email });
  }
  return res.status(401).json({ message: '未登录' });
});

module.exports = router;
