import { api } from './client'

export const getN8nStatus = async () => {
  const { data } = await api.get('/n8n/status')
  return data
}

export const startN8n = async () => {
  const { data } = await api.post('/n8n/start')
  return data
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
