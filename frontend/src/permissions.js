export const RESOURCES = [
  { id: 'offices', label: 'Offices' },
  { id: 'rooms', label: 'Conference rooms' },
  { id: 'hardware', label: 'Hardware' },
  { id: 'inventory', label: 'Shelf inventory' },
];

export function can(user, resource, action) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return Boolean(user.permissions?.[resource]?.[action]);
}

export function emptyPermissions() {
  return Object.fromEntries(RESOURCES.map((resource) => [resource.id, { read: false, write: false }]));
}

export function defaultNewUserPermissions() {
  return {
    offices: { read: true, write: false },
    rooms: { read: true, write: false },
    hardware: { read: true, write: false },
    inventory: { read: false, write: false },
  };
}
