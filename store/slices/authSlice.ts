// src/store/slices/authSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface AuthState {
  user: Record<string, any> | null // ✅ store all user attributes
  token: string | null
  payload?: Record<string, any>
  isLoggedIn: boolean
  isFirstLaunch: boolean
}

const initialState: AuthState = {
  user: null,
  token: null,
  payload: undefined,
  isLoggedIn: false,
  isFirstLaunch: true,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthState: (
      state,
      action: PayloadAction<{
        user: Record<string, any> | null
        token: string | null
        payload?: Record<string, any>
        isLoggedIn: boolean
      }>
    ) => {
      state.user = action.payload.user
      state.token = action.payload.token
      state.payload = action.payload.payload
      state.isLoggedIn = action.payload.isLoggedIn
    },
    setFirstLaunch: (state, action: PayloadAction<boolean>) => {
      state.isFirstLaunch = action.payload
    },
    resetAuth: () => initialState,
  },
})

export const { setAuthState, setFirstLaunch, resetAuth } = authSlice.actions
export default authSlice.reducer
