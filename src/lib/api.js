const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

const jsonHeaders = {
  'Content-Type': 'application/json',
}

async function request(path, options = {}) {
  const { headers = {}, ...requestOptions } = options
  let response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        ...jsonHeaders,
        ...headers,
      },
      ...requestOptions,
    })
  } catch {
    throw new Error('Cannot connect to the API server.')
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.message || 'Request failed')
  }

  return response.json()
}

function buildProfilePath(adminEmail = '') {
  const normalizedEmail = String(adminEmail || '').trim().toLowerCase()

  if (!normalizedEmail) {
    return '/api/profile'
  }

  return `/api/profile?email=${encodeURIComponent(normalizedEmail)}`
}

export const inventoryApi = {
  login: (payload) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getProfile: (adminEmail = '') => request(buildProfilePath(adminEmail)),
  updateProfile: (payload) =>
    request('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updateEmail: (payload) =>
    request('/api/profile/email', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updatePassword: (payload) =>
    request('/api/profile/password', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  getProducts: () => request('/api/products'),
  createProduct: (payload) =>
    request('/api/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProduct: (id, payload) =>
    request(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteProduct: (id) =>
    request(`/api/products/${id}`, {
      method: 'DELETE',
    }),
}
