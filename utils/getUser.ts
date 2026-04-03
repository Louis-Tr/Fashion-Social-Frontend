import { store } from '@/store/store'

export function getUser(): Record<string, any> | null {
  const state = store.getState() as any
  const user = state.auth.user || null
  if (!user) {
    throw new Error('Not authenticated')
  }
  return user
}
