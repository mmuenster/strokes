const BASE = '/api';

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

export const api = {
  rounds: {
    list: () => req('GET', '/rounds'),
    get: (id) => req('GET', `/rounds/${id}`),
    create: (body) => req('POST', '/rounds', body),
    update: (id, body) => req('PUT', `/rounds/${id}`, body),
    delete: (id) => req('DELETE', `/rounds/${id}`),
  },
  holes: {
    create: (roundId, body) => req('POST', `/rounds/${roundId}/holes`, body),
    update: (id, body) => req('PUT', `/holes/${id}`, body),
    delete: (id) => req('DELETE', `/holes/${id}`),
  },
  shots: {
    create: (holeId, body) => req('POST', `/holes/${holeId}/shots`, body),
    update: (id, body) => req('PUT', `/shots/${id}`, body),
    delete: (id) => req('DELETE', `/shots/${id}`),
  },
};
