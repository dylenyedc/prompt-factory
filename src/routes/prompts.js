'use strict';

const express = require('express');
const prisma = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

const OUTFIT_CATEGORY_KEYS = ['tops', 'bottoms', 'shoes', 'headwear', 'accessories', 'weapons', 'others'];

// Assemble prompt data in the original JSON structure for a given user
async function assemblePromptData(userId) {
  const simpleGroups = await prisma.group.findMany({
    where: { userId, section: { in: ['chars', 'actions', 'env'] } },
    include: { items: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'asc' }
  });

  const outfitGroups = await prisma.group.findMany({
    where: { userId, section: 'outfit' },
    include: { items: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'asc' }
  });

  const bySection = { chars: [], actions: [], env: [] };

  for (const g of simpleGroups) {
    let tags = [];
    try {
      tags = JSON.parse(g.tagsText || '[]');
    } catch (_) {
      tags = [];
    }

    const entry = {
      id: g.id,
      title: g.title,
      items: g.items.map(i => ({ id: i.id, name: i.name, prompt: i.prompt }))
    };
    if (g.section === 'chars') {
      entry.tags = tags;
    }
    bySection[g.section].push(entry);
  }

  const outfit = outfitGroups.map(g => {
    const entry = { id: g.id, title: g.title };
    for (const cat of OUTFIT_CATEGORY_KEYS) {
      entry[cat] = g.items
        .filter(i => i.categoryKey === cat)
        .map(i => ({ id: i.id, name: i.name, prompt: i.prompt }));
    }
    return entry;
  });

  return { chars: bySection.chars, actions: bySection.actions, env: bySection.env, outfit };
}

// GET /api/prompts - returns current user's prompt data in original format
router.get('/', requireAuth, async (req, res) => {
  try {
    const data = await assemblePromptData(req.session.userId);
    return res.json(data);
  } catch (err) {
    console.error('GET /api/prompts error', err);
    return res.status(500).json({ message: '读取数据失败', detail: err.message });
  }
});

// PUT /api/prompts - upsert-style overwrite of current user's data
router.put('/', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const body = req.body;

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ message: '数据格式错误' });
  }

  try {
    // Use a transaction to replace all user data atomically
    await prisma.$transaction(async (tx) => {
      // Delete all existing groups (items cascade via onDelete: Cascade)
      await tx.group.deleteMany({ where: { userId } });

      // Re-create chars
      const chars = Array.isArray(body.chars) ? body.chars : [];
      for (const group of chars) {
        if (!group || typeof group !== 'object') continue;
        await tx.group.create({
          data: {
            id: group.id || undefined,
            userId,
            section: 'chars',
            title: String(group.title || '未命名分组'),
            tagsText: JSON.stringify(Array.isArray(group.tags) ? group.tags : []),
            items: {
              create: (Array.isArray(group.items) ? group.items : []).map(i => ({
                id: i.id || undefined,
                userId,
                name: String(i.name || ''),
                prompt: String(i.prompt || '')
              }))
            }
          }
        });
      }

      // Re-create actions and env
      for (const section of ['actions', 'env']) {
        const groups = Array.isArray(body[section]) ? body[section] : [];
        for (const group of groups) {
          if (!group || typeof group !== 'object') continue;
          await tx.group.create({
            data: {
              id: group.id || undefined,
              userId,
              section,
              title: String(group.title || '未命名分组'),
              items: {
                create: (Array.isArray(group.items) ? group.items : []).map(i => ({
                  id: i.id || undefined,
                  userId,
                  name: String(i.name || ''),
                  prompt: String(i.prompt || '')
                }))
              }
            }
          });
        }
      }

      // Re-create outfit
      const outfitGroups = Array.isArray(body.outfit) ? body.outfit : [];
      for (const group of outfitGroups) {
        if (!group || typeof group !== 'object') continue;
        const outfitItems = [];
        for (const cat of OUTFIT_CATEGORY_KEYS) {
          const catItems = Array.isArray(group[cat]) ? group[cat] : [];
          for (const i of catItems) {
            outfitItems.push({
              id: i.id || undefined,
              userId,
              name: String(i.name || ''),
              prompt: String(i.prompt || ''),
              categoryKey: cat
            });
          }
        }
        await tx.group.create({
          data: {
            id: group.id || undefined,
            userId,
            section: 'outfit',
            title: String(group.title || '未命名风格'),
            items: { create: outfitItems }
          }
        });
      }
    });

    return res.json({ message: '保存成功' });
  } catch (err) {
    console.error('PUT /api/prompts error', err);
    return res.status(500).json({ message: '保存失败', detail: err.message });
  }
});

module.exports = router;
module.exports.assemblePromptData = assemblePromptData;
