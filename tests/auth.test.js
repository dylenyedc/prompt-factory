'use strict';

// Basic integration tests using Node's built-in test runner and supertest.
// Run with: npm test  (requires DATABASE_URL to point to a test SQLite DB)

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const path = require('path');
const fs = require('fs');

// Use a separate test database so we don't pollute dev.db
const TEST_DB = path.join(__dirname, '..', 'test.db');
process.env.DATABASE_URL = `file:${TEST_DB}`;
process.env.SESSION_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

// Prisma needs DATABASE_URL before requiring the module
const { execSync } = require('child_process');

// Run migrations against the test DB before all tests
before(async () => {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB}` },
    stdio: 'pipe'
  });
});

// Clean up the test DB after all tests
after(() => {
  try { fs.unlinkSync(TEST_DB); } catch (_) {}
  try { fs.unlinkSync(TEST_DB + '-journal'); } catch (_) {}
});

const app = require('../src/app');
const request = supertest(app);

describe('Auth – register & login', () => {
  const EMAIL = `test_${Date.now()}@example.com`;
  const PASSWORD = 'password123';

  it('should register a new user and return 201', async () => {
    const res = await request.post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });
    assert.equal(res.status, 201);
    assert.equal(res.body.email, EMAIL);
  });

  it('should return 409 when registering with the same email again', async () => {
    const res = await request.post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });
    assert.equal(res.status, 409);
  });

  it('should return 400 for invalid email', async () => {
    const res = await request.post('/api/auth/register').send({ email: 'notanemail', password: PASSWORD });
    assert.equal(res.status, 400);
  });

  it('should return 400 for short password', async () => {
    const res = await request.post('/api/auth/register').send({ email: 'new@example.com', password: 'short' });
    assert.equal(res.status, 400);
  });

  it('should login with correct credentials and return 200', async () => {
    const res = await request.post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.body.email, EMAIL);
  });

  it('should return 401 for wrong password', async () => {
    const res = await request.post('/api/auth/login').send({ email: EMAIL, password: 'wrongpassword' });
    assert.equal(res.status, 401);
  });
});

describe('/api/prompts – authentication guard', () => {
  it('GET /api/prompts should return 401 when not logged in', async () => {
    const res = await request.get('/api/prompts');
    assert.equal(res.status, 401);
  });

  it('PUT /api/prompts should return 401 when not logged in', async () => {
    const res = await request.put('/api/prompts').send({ chars: [], actions: [], env: [], outfit: [] });
    assert.equal(res.status, 401);
  });

  it('GET /api/prompts should return data after login', async () => {
    const EMAIL = `prompttest_${Date.now()}@example.com`;
    const PASSWORD = 'password123';

    // Create agent to persist cookie across requests
    const agent = supertest.agent(app);

    // Register and login
    await agent.post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });
    await agent.post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });

    const res = await agent.get('/api/prompts');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.chars));
    assert.ok(Array.isArray(res.body.actions));
    assert.ok(Array.isArray(res.body.env));
    assert.ok(Array.isArray(res.body.outfit));
  });

  it('PUT then GET /api/prompts should persist data', async () => {
    const EMAIL = `puttest_${Date.now()}@example.com`;
    const PASSWORD = 'password123';
    const agent = supertest.agent(app);

    await agent.post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });

    const payload = {
      chars: [{ id: 'g1', title: '测试角色', tags: ['tag1'], items: [{ id: 'i1', name: '测试', prompt: 'test prompt' }] }],
      actions: [],
      env: [],
      outfit: []
    };

    const putRes = await agent.put('/api/prompts').send(payload);
    assert.equal(putRes.status, 200);

    const getRes = await agent.get('/api/prompts');
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.chars.length, 1);
    assert.equal(getRes.body.chars[0].title, '测试角色');
    assert.equal(getRes.body.chars[0].items[0].prompt, 'test prompt');
  });
});

describe('/api/me', () => {
  it('should return 401 when not logged in', async () => {
    const res = await request.get('/api/me');
    assert.equal(res.status, 401);
  });

  it('should return user info when logged in', async () => {
    const EMAIL = `metest_${Date.now()}@example.com`;
    const PASSWORD = 'password123';
    const agent = supertest.agent(app);
    await agent.post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });
    const res = await agent.get('/api/me');
    assert.equal(res.status, 200);
    assert.equal(res.body.email, EMAIL);
  });
});
