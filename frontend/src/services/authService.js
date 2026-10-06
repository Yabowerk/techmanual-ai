import api from './api'

export const register = async (email, password, name) => {
  const response = await api.post('/auth/register', { email, password, name })
  return response.data
}

export const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password })
  return response.data
}

export const logout = async () => {
  try {
    await api.post('/auth/logout')
  } catch (error) {
    // Ignore logout errors - we'll clear local storage anyway
    console.warn('Logout request failed:', error.message)
  }
}

export const getMe = async () => {
  const response = await api.get('/auth/me')
  return response.data
}

export const refreshToken = async (refreshToken) => {
  const response = await api.post('/auth/refresh', { refreshToken })
  return response.data
}

export const validateToken = async () => {
  try {
    const response = await api.get('/auth/me')
    return { valid: true, user: response.data.user }
  } catch (error) {
    return { valid: false, error: error.message }
  }
}
