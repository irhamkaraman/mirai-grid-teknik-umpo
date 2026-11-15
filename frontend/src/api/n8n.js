import { api } from './client'

export const getN8nStatus = async () => {
  const { data } = await api.get('/n8n/status')
  return data
}

export const startN8n = async () => {
  const { data } = await api.post('/n8n/start')
  return data
}

export const startN8nAsync = async () => {
  const { data } = await api.post('/n8n/start-async')
  return data
}

export const buildN8nSsoRedirectUrl = () => {
  const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
  const token = localStorage.getItem('miraigrid_token') || localStorage.getItem('token') || ''
  return `${base}/n8n/sso-redirect?token=${encodeURIComponent(token)}`
}

export const stopN8n = async () => {
  const { data } = await api.post('/n8n/stop')
  return data
}

export const restartN8n = async () => {
  const { data } = await api.post('/n8n/restart')
  return data
}

export const getN8nSSO = async () => {
  const { data } = await api.get('/n8n/sso', { withCredentials: true })
  return data
}
