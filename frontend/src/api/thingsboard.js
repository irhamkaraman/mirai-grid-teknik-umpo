import { api } from './client'

export const getThingsBoardStatus = async () => {
  const res = await api.get('/thingsboard/status')
  return res.data
}

export const startThingsBoard = async () => {
  const res = await api.post('/thingsboard/start')
  return res.data
}

export const stopThingsBoard = async () => {
  const res = await api.post('/thingsboard/stop')
  return res.data
}

export const restartThingsBoard = async () => {
  const res = await api.post('/thingsboard/restart')
  return res.data
}
