const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

const failures = new Map();

function keyFor(kind, value) {
  return `${kind}:${String(value || '').trim().toLowerCase()}`;
}

function prune(key) {
  const entry = failures.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.resetAt) {
    failures.delete(key);
    return null;
  }
  return entry;
}

function isLocked(kind, value) {
  const name = String(value || '').trim();
  if (!name) return false;
  const entry = prune(keyFor(kind, name));
  return Boolean(entry && entry.count >= MAX_FAILURES);
}

function recordFailure(kind, value) {
  const name = String(value || '').trim();
  if (!name) return;
  const key = keyFor(kind, name);
  const existing = prune(key);
  if (!existing) {
    failures.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
    return;
  }
  existing.count += 1;
}

function clearFailures(kind, value) {
  const name = String(value || '').trim();
  if (!name) return;
  failures.delete(keyFor(kind, name));
}

module.exports = {
  WINDOW_MS,
  MAX_FAILURES,
  isLocked,
  recordFailure,
  clearFailures,
};
