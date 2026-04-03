// store/slices/loadingSlice.ts
import { createSlice } from '@reduxjs/toolkit'

interface LoadingState {
  global: boolean
}

const initialState: LoadingState = {
  global: false,
}

const loadingSlice = createSlice({
  name: 'loading',
  initialState,
  reducers: {
    startLoading: (state) => {
      state.global = true
    },
    stopLoading: (state) => {
      state.global = false
    },
  },
})

export const { startLoading, stopLoading } = loadingSlice.actions
export default loadingSlice.reducer
