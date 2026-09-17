const BASE = '/api';
export const TOKEN_KEY = 'avtracker-token';
export const AUTH_EXPIRED_EVENT = 'avtracker-auth-expired';

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !options.skipAuthRedirect) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

export const api = {
  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipAuthRedirect: true,
    }),
  loginTotp: (challengeToken, code) =>
    request('/auth/login/totp', {
      method: 'POST',
      body: JSON.stringify({ challengeToken, code }),
      skipAuthRedirect: true,
    }),
  me: () => request('/auth/me', { skipAuthRedirect: true }),
  getTotpStatus: () => request('/auth/totp/status'),
  setupTotp: () => request('/auth/totp/setup', { method: 'POST' }),
  enableTotp: (code) => request('/auth/totp/enable', { method: 'POST', body: JSON.stringify({ code }) }),
  disableTotp: (code) => request('/auth/totp/disable', { method: 'POST', body: JSON.stringify({ code }) }),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  getUsers: () => request('/users'),
  createUser: (body) => request('/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id, body) => request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

  getOffices: () => request('/offices'),
  getOffice: (id) => request(`/offices/${id}`),
  createOffice: (body) => request('/offices', { method: 'POST', body: JSON.stringify(body) }),
  updateOffice: (id, body) => request(`/offices/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteOffice: (id) => request(`/offices/${id}`, { method: 'DELETE' }),

  getRooms: (officeId) => request(`/rooms${officeId ? `?officeId=${officeId}` : ''}`),
  getRoom: (id) => request(`/rooms/${id}`),
  getRoomHardware: (id) => request(`/rooms/${id}/hardware`),
  createRoom: (body) => request('/rooms', { method: 'POST', body: JSON.stringify(body) }),
  createJobSite: (body) => request('/rooms/job-sites', { method: 'POST', body: JSON.stringify(body) }),
  updateRoom: (id, body) => request(`/rooms/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteRoom: (id) => request(`/rooms/${id}`, { method: 'DELETE' }),

  getHardware: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/hardware${query ? `?${query}` : ''}`);
  },
  getHardwareItem: (id, revealPassword = false) =>
    request(`/hardware/${id}${revealPassword ? '?revealPassword=true' : ''}`),
  createHardware: (body) => request('/hardware', { method: 'POST', body: JSON.stringify(body) }),
  updateHardware: (id, body) => request(`/hardware/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  assignHardware: (id, conferenceRoomId, extras = {}) =>
    request(`/hardware/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ conferenceRoomId, ...extras }),
    }),
  deleteHardware: (id) => request(`/hardware/${id}`, { method: 'DELETE' }),
  deleteHardwareBulk: (ids) => Promise.all(ids.map((id) => request(`/hardware/${id}`, { method: 'DELETE' }))),
  bulkUpdateHardware: (ids, updates) =>
    request('/hardware/bulk-update', { method: 'PATCH', body: JSON.stringify({ ids, updates }) }),
  importHardware: (csv, location = {}) =>
    request('/hardware/import', {
      method: 'POST',
      body: JSON.stringify({
        csv,
        officeId: location.officeId || undefined,
        conferenceRoomId: location.conferenceRoomId || undefined,
      }),
    }),

  getInventory: () => request('/inventory'),
  createInventory: (body) => request('/inventory', { method: 'POST', body: JSON.stringify(body) }),
  updateInventory: (id, body) => request(`/inventory/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  updateInventoryQuantity: (id, quantity) =>
    request(`/inventory/${id}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
  deleteInventory: (id) => request(`/inventory/${id}`, { method: 'DELETE' }),
};
