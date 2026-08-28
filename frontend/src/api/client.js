const BASE = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

export const api = {
  getOffices: () => request('/offices'),
  getOffice: (id) => request(`/offices/${id}`),
  createOffice: (body) => request('/offices', { method: 'POST', body: JSON.stringify(body) }),
  updateOffice: (id, body) => request(`/offices/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteOffice: (id) => request(`/offices/${id}`, { method: 'DELETE' }),

  getRooms: (officeId) => request(`/rooms${officeId ? `?officeId=${officeId}` : ''}`),
  getRoom: (id) => request(`/rooms/${id}`),
  getRoomHardware: (id) => request(`/rooms/${id}/hardware`),
  createRoom: (body) => request('/rooms', { method: 'POST', body: JSON.stringify(body) }),
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
  assignHardware: (id, conferenceRoomId) =>
    request(`/hardware/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ conferenceRoomId }),
    }),
  deleteHardware: (id) => request(`/hardware/${id}`, { method: 'DELETE' }),
  deleteHardwareBulk: (ids) => Promise.all(ids.map((id) => request(`/hardware/${id}`, { method: 'DELETE' }))),
  bulkUpdateHardware: (ids, updates) =>
    request('/hardware/bulk-update', { method: 'PATCH', body: JSON.stringify({ ids, updates }) }),
  importHardware: (csv) => request('/hardware/import', { method: 'POST', body: JSON.stringify({ csv }) }),
};
