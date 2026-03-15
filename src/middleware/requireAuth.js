'use strict';

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ message: '请先登录' });
}

module.exports = requireAuth;
