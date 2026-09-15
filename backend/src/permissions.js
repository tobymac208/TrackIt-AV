const RESOURCES = ['offices', 'rooms', 'hardware', 'inventory'];
const MAX_ADMINS = 3;

const ALL_ACCESS = Object.fromEntries(RESOURCES.map((resource) => [resource, { read: true, write: true }]));
const VIEW_ONLY = {
  offices: { read: true, write: false },
  rooms: { read: true, write: false },
  hardware: { read: true, write: false },
  inventory: { read: false, write: false },
};

function emptyPermissions() {
  return Object.fromEntries(RESOURCES.map((resource) => [resource, { read: false, write: false }]));
}

function normalizePermissions(input) {
  const next = emptyPermissions();
  if (!input || typeof input !== 'object') return next;
  for (const resource of RESOURCES) {
    const value = input[resource] || {};
    next[resource] = {
      read: Boolean(value.read || value.write),
      write: Boolean(value.write),
    };
  }
  return next;
}

function permissionsFor(user) {
  if (!user) return emptyPermissions();
  if (user.role === 'admin') return ALL_ACCESS;
  if (user.permissions) {
    try {
      const parsed = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
      return normalizePermissions(parsed);
    } catch {
      return VIEW_ONLY;
    }
  }
  return VIEW_ONLY;
}

function can(user, resource, action) {
  if (!RESOURCES.includes(resource) || !['read', 'write'].includes(action)) return false;
  return Boolean(permissionsFor(user)[resource]?.[action]);
}

function resourceFromRequest(req) {
  const full = `${req.baseUrl || ''}${req.path || ''}`;
  const match = full.match(/^\/api\/([a-z]+)/);
  return match ? match[1] : null;
}

module.exports = {
  RESOURCES,
  MAX_ADMINS,
  ALL_ACCESS,
  VIEW_ONLY,
  normalizePermissions,
  permissionsFor,
  can,
  resourceFromRequest,
};
