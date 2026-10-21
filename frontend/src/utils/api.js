// =============================================================
// frontend/src/utils/api.js  —  one place that talks to the backend
// =============================================================
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// apiCall('/bookings', 'POST', { ... })  ->  parsed JSON, or throws Error(message)
// The message is exactly what the backend sent (e.g. "This slot was just booked ..."),
// so it can be shown to the user as it is.
export async function apiCall(path, method = 'GET', body) {
  let res;
  try {
    const token = localStorage.getItem('cst_token');
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Could not reach the server. Is the backend running?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status; // lets callers treat 409 (conflict) differently
    throw err;
  }
  return data;
}