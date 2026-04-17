import { useState, useCallback } from 'react'
import api from '../lib/api'

export function useSessionsApi() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const clearError = () => setError('')

  const withLoading = async (fn) => {
    setLoading(true)
    setError('')
    try {
      return await fn()
    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail)
        ? detail.map(e => e.msg).join(', ')
        : detail || err.message || 'Request failed'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const fetchSessions = useCallback(() =>
    withLoading(() => api.get('/api/sessions/').then(r => r.data)), [])

  const createSession = useCallback((data) =>
    withLoading(() => api.post('/api/sessions/', data).then(r => r.data)), [])

  const acceptSession = useCallback((id, data = {}) =>
    withLoading(() => api.post(`/api/sessions/${id}/accept`, data).then(r => r.data)), [])

  const completeSession = useCallback((id) =>
    withLoading(() => api.post(`/api/sessions/${id}/complete`).then(r => r.data)), [])

  const runCodeREST = useCallback((roomToken, code, language) =>
    withLoading(() => api.post(`/api/workspace/${roomToken}/run`, { code, language }).then(r => r.data)), [])

  const fetchConceptGraph = useCallback((roomToken, transcript) =>
    withLoading(() => api.post(`/api/workspace/${roomToken}/concept-graph`, { transcript }).then(r => r.data)), [])

  return {
    loading, error, clearError,
    fetchSessions, createSession, acceptSession, completeSession,
    runCodeREST, fetchConceptGraph,
  }
}
