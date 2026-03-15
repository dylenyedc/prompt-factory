'use strict';

const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { assemblePromptData } = require('./prompts');

const router = express.Router();

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s_\-]+/g, '')
    .trim();
}

function isSubsequence(needle, haystack) {
  if (!needle || !haystack) return false;
  let i = 0;
  let j = 0;
  while (i < needle.length && j < haystack.length) {
    if (needle[i] === haystack[j]) i += 1;
    j += 1;
  }
  return i === needle.length;
}

function scoreField(rawKeyword, normalizedKeyword, value) {
  const raw = String(value || '');
  const normalized = normalizeText(raw);
  if (!raw || !normalized) return 0;
  const lowerRaw = raw.toLowerCase();
  const lowerKeyword = String(rawKeyword || '').toLowerCase().trim();
  if (normalized === normalizedKeyword) return 120;
  if (normalized.startsWith(normalizedKeyword)) return 90;
  if (normalized.includes(normalizedKeyword)) return 70;
  if (lowerKeyword && lowerRaw.includes(lowerKeyword)) return 65;
  if (isSubsequence(normalizedKeyword, normalized)) return 40;
  return 0;
}

function searchPromptDatabase(data, keyword, options) {
  const limit = Math.max(1, Math.min(Number(options.limit) || 10, 100));
  const sectionFilter = options.section ? String(options.section).trim() : '';
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) return [];

  const sections = ['chars', 'actions', 'env', 'outfit'];
  const targetSections = sectionFilter && sections.includes(sectionFilter)
    ? [sectionFilter]
    : sections;

  const OUTFIT_CATEGORY_KEYS = ['tops', 'bottoms', 'shoes', 'headwear', 'accessories', 'weapons', 'others'];
  const categoryLabelMap = {
    tops: '上衣', bottoms: '下装', shoes: '鞋子',
    headwear: '头饰', accessories: '配件', weapons: '武器', others: '其他'
  };

  const results = [];

  for (const section of targetSections) {
    const groups = Array.isArray(data[section]) ? data[section] : [];
    for (const group of groups) {
      const groupId = group.id || '';
      const groupTitle = group.title || '';
      const groupTags = Array.isArray(group.tags) ? group.tags : [];
      const items = [];

      if (section === 'outfit') {
        for (const cat of OUTFIT_CATEGORY_KEYS) {
          const catItems = Array.isArray(group[cat]) ? group[cat] : [];
          for (const item of catItems) {
            items.push({ ...item, categoryKey: cat });
          }
        }
      } else {
        for (const item of Array.isArray(group.items) ? group.items : []) {
          items.push(item);
        }
      }

      for (const item of items) {
        const itemName = item.name || '';
        const prompt = item.prompt || '';
        const categoryKey = item.categoryKey || '';
        const matchedFields = [];
        let totalScore = 0;

        const nameScore = scoreField(keyword, normalizedKeyword, itemName);
        if (nameScore > 0) { matchedFields.push('item.name'); totalScore += nameScore + 30; }

        const titleScore = scoreField(keyword, normalizedKeyword, groupTitle);
        if (titleScore > 0) { matchedFields.push('group.title'); totalScore += titleScore + 20; }

        if (section === 'outfit' && categoryKey) {
          const catScore = scoreField(keyword, normalizedKeyword, categoryLabelMap[categoryKey] || categoryKey);
          if (catScore > 0) { matchedFields.push('outfit.category'); totalScore += catScore + 10; }
        }

        const tagScore = groupTags.reduce((best, tag) => Math.max(best, scoreField(keyword, normalizedKeyword, tag)), 0);
        if (tagScore > 0) { matchedFields.push('group.tags'); totalScore += tagScore + 15; }

        const promptScore = scoreField(keyword, normalizedKeyword, prompt);
        if (promptScore > 0) { matchedFields.push('item.prompt'); totalScore += promptScore; }

        if (totalScore > 0) {
          results.push({
            section, groupId, groupTitle,
            itemId: item.id || '', itemName, prompt, categoryKey,
            tags: groupTags, score: totalScore, matchedFields
          });
        }
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

// GET /api/agent-skill/search
router.get('/', requireAuth, async (req, res) => {
  const keyword = req.query.keyword || req.query.q || '';
  const limit = req.query.limit || '10';
  const section = req.query.section || '';

  if (!String(keyword).trim()) {
    return res.status(400).json({ message: '缺少关键词参数，请提供 keyword 或 q' });
  }

  try {
    const data = await assemblePromptData(req.session.userId);
    const results = searchPromptDatabase(data, keyword, { limit, section });
    return res.json({
      skill: 'prompt-search',
      query: String(keyword),
      section: section || 'all',
      total: results.length,
      results
    });
  } catch (err) {
    console.error('search error', err);
    return res.status(500).json({ message: '检索失败', detail: err.message });
  }
});

module.exports = router;
