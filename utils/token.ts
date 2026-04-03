import { store } from '@/store/store'

export function getToken(): string | null {
  const state = store.getState() as any
  const token = state.auth.token || null
  if (!token) {
    throw new Error('Not authenticated')
  }
  return token
}
