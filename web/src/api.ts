const API_BASE = import.meta.env.VITE_API_BASE || 'https://zappy-seo-engine-r64i.encoreapi.com';

export const fetchStats = () => fetch(`${API_BASE}/content/stats`).then(res => res.json());
export const fetchKeywords = () => fetch(`${API_BASE}/keywords`).then(res => res.json());
export const fetchContent = () => fetch(`${API_BASE}/content`).then(res => res.json());
export const fetchLogs = (id: number) => fetch(`${API_BASE}/content/logs/${id}`).then(res => res.json());
export const seedTopic = (topic: string) => fetch(`${API_BASE}/keywords/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic })
});
export const startGeneration = (id: number) => fetch(`${API_BASE}/content/generate/${id}`, { method: 'POST' });
export const startBatch = () => fetch(`${API_BASE}/content/batch`, { method: 'POST' });
export const updateContent = (id: number, data: any) => fetch(`${API_BASE}/content/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
