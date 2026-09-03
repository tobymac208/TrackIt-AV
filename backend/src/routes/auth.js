const express = require('express');
const asyncHandler = require('../asyncHandler');
const { login, requireAuth } = require('../auth');

const router = express.Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    const result = await login(username, password);
    if (!result) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    res.json(result);
  })
);

router.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

module.exports = router;
