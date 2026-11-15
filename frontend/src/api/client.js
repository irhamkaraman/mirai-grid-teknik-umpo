import axios from 'axios'
import { clearSharedAuthCookie, getAuthLoginUrl, isAuthSubdomain } from '../utils/authHost'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Auto inject Bearer token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('miraigrid_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('miraigrid_token')
      localStorage.removeItem('miraigrid_user')
      clearSharedAuthCookie()
      if (!isAuthSubdomain() && window.location.pathname !== '/login') {
        window.location.replace(getAuthLoginUrl())
      }
    }
    return Promise.reject(error)
  }
)
