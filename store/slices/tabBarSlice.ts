import { createSlice, PayloadAction } from '@reduxjs/toolkit'

type TabBarState = {
  visible: boolean
}

const initialState: TabBarState = {
  visible: true,
}

const tabBarSlice = createSlice({
  name: 'tabBar',
  initialState,
  reducers: {
    showTabBar(state) {
      state.visible = true
    },
    hideTabBar(state) {
      state.visible = false
    },
    setTabBarVisible(state, action: PayloadAction<boolean>) {
      state.visible = action.payload
    },
  },
})

export const { showTabBar, hideTabBar, setTabBarVisible } = tabBarSlice.actions
export default tabBarSlice.reducer
