const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const TOKEN_KEY = 'notes_app_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function isAuthenticated() {
  return !!getToken()
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_URL}${path}`, {
    headers,
    ...options,
  })
  if (res.status === 401 && !path.includes('/auth/')) {
    setToken(null)
    window.dispatchEvent(new Event('notes-auth-expired'))
  }
  if (!res.ok) {
    let detail = `API error: ${res.status}`
    try {
      const body = await res.json()
      if (body && body.detail) detail = body.detail
    } catch (e) { /* ignore */ }
    throw new Error(detail)
  }
  return res.json()
}

export async function register(username, password) {
  const data = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  if (data.access_token) setToken(data.access_token)
  return data
}

export async function login(username, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  if (data.access_token) setToken(data.access_token)
  return data
}

export async function fetchMe() {
  return request('/auth/me')
}

export async function fetchNotes(q, tag) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (tag) params.set('tag', tag)
  const query = params.toString()
  return request(`/notes${query ? '?' + query : ''}`)
}

export async function fetchNote(id) {
  return request(`/notes/${id}`)
}

export async function createNote(note) {
  return request('/notes', {
    method: 'POST',
    body: JSON.stringify(note),
  })
}

export async function updateNote(id, updates) {
  return request(`/notes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
}

export async function deleteNote(id) {
  return request(`/notes/${id}`, { method: 'DELETE' })
}

export async function duplicateNote(id) {
  return request(`/notes/${id}/duplicate`, { method: 'POST' })
}

export async function fetchTags() {
  return request('/tags')
}