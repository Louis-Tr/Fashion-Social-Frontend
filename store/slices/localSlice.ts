import { createSlice } from '@reduxjs/toolkit'

interface LocalState {
  avatarKey: string | null
}

const initialState: LocalState = {
  avatarKey: null,
}

const localSlice = createSlice({
  name: 'local',
  initialState,
  reducers: {
    setAvatarKey: (state, action) => {
      state.avatarKey = action.payload
    },
  },
})

export const { setAvatarKey } = localSlice.actions
export default localSlice.reducer
