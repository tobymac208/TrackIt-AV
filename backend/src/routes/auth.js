const express = require('express');
const asyncHandler = require('../asyncHandler');
const {
  login,
  completeTotpLogin,
  getTotpStatus,
  startTotpSetup,
  enableTotp,
  disableTotp,
  changePassword,
  requireAuth,
} = require('../auth');
const { isLocked, recordFailure, clearFailures } = require('../loginGuard');

const router = express.Router();
const LOCKOUT_MESSAGE = 'Too many sign-in attempts. Try again later.';

function sendAuthError(res, err) {
  return res.status(err.status || 500).json({ error: err.message || 'Request failed' });
}

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    if (isLocked('password', username)) {
      return res.status(429).json({ error: LOCKOUT_MESSAGE });
    }
    const result = await login(username, password);
    if (!result) {
      recordFailure('password', username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    clearFailures('password', username);
    res.json(result);
  })
);

router.post(
  '/login/totp',
  asyncHandler(async (req, res) => {
    const { challengeToken, code } = req.body || {};
    const result = await completeTotpLogin(challengeToken, code);
    if (result?.locked) {
      return res.status(429).json({ error: LOCKOUT_MESSAGE });
    }
    if (!result) {
      return res.status(401).json({ error: 'Invalid authenticator code' });
    }
    res.json(result);
  })
);

router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

router.get(
  '/totp/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await getTotpStatus(req.user.id));
  })
);

router.post(
  '/totp/setup',
  requireAuth,
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
  asyncHandler(async (req, res) => {
    try {
      res.json(await disableTotp(req.user, req.body?.code));
    } catch (err) {
      sendAuthError(res, err);
    }
  })
);

router.post(
  '/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      res.json(await changePassword(req.user, req.body?.currentPassword, req.body?.newPassword));
    } catch (err) {
      sendAuthError(res, err);
    }
  })
);

module.exports = router;
