import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import loadingReducer from './slices/loadingSlice'
import storyReducer from './slices/storySlice'
import postReducer from './slices/postSlice'
import localReducer from './slices/localSlice'
import conversationReducer from './slices/conversationSlice'
import tabBarReducer from './slices/tabBarSlice'
import meReducer from './slices/meSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    loading: loadingReducer,
    story: storyReducer,
    post: postReducer,
    local: localReducer,
    conversation: conversationReducer,
    tab: tabBarReducer,
    me: meReducer,
    // add more slices here
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
