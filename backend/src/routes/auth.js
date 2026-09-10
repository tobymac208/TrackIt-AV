const express = require('express');
const asyncHandler = require('../asyncHandler');
const {
  login,
  completeTotpLogin,
  getTotpStatus,
  startTotpSetup,
  enableTotp,
  disableTotp,
  requireAuth,
  requireAdmin,
} = require('../auth');

const router = express.Router();

function sendAuthError(res, err) {
  return res.status(err.status || 500).json({ error: err.message || 'Request failed' });
}

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

router.post(
  '/login/totp',
  asyncHandler(async (req, res) => {
    const { challengeToken, code } = req.body || {};
    const result = await completeTotpLogin(challengeToken, code);
    if (!result) {
      return res.status(401).json({ error: 'Invalid authenticator code' });
    }
    res.json(result);
  })
);

router.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

router.get(
  '/totp/status',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await getTotpStatus(req.user.id));
  })
);

router.post(
  '/totp/setup',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      res.json(await startTotpSetup(req.user));
    } catch (err) {
      sendAuthError(res, err);
    }
  })
);

router.post(
  '/totp/enable',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      res.json(await enableTotp(req.user, req.body?.code));
    } catch (err) {
      sendAuthError(res, err);
    }
  })
);

router.post(
  '/totp/disable',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      res.json(await disableTotp(req.user, req.body?.code));
    } catch (err) {
      sendAuthError(res, err);
    }
  })
);

module.exports = router;
