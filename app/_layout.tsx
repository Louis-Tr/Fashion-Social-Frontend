import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Provider, useDispatch, useSelector } from 'react-redux'
import { SplashScreen, Stack } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { Amplify } from 'aws-amplify'
import '@aws-amplify/react-native'
import { fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'

import '../global.css'
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
} from '@expo-google-fonts/inter'

import { awsConfig } from '@/awsconfig'
import { RootState, store } from '@/store/store'
import { setAuthState, setFirstLaunch } from '@/store/slices/authSlice'
import { WebSocketProvider } from '@/contexts/WebSocketContext'

SplashScreen.preventAutoHideAsync()

// Configure Amplify once (module scope)
try {
  Amplify.configure(awsConfig)
  console.log('✅ Amplify configured:', Amplify.getConfig())
} catch (e) {
  console.error('❌ Amplify config failed:', e)
}

console.log('App Layout - process.env:', process.env)

async function checkFirstLaunch(): Promise<boolean> {
  const hasLaunched = await AsyncStorage.getItem('hasLaunched')
  console.log('AsyncStorage - hasLaunched:', hasLaunched)

  if (hasLaunched === null) {
    await AsyncStorage.setItem('hasLaunched', 'true')
    console.log('First launch detected. Setting flag.')
    return true
  }
  return false
}

function FullscreenSpinner() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  )
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <RootLayoutInner />
      </Provider>
    </GestureHandlerRootView>
  )
}

function RootLayoutInner() {
  const dispatch = useDispatch()
  const auth = useSelector((state: RootState) => state.auth)

  const [checking, setChecking] = useState(true)

  const [loaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
  })

  // Ensure we don't render until fonts are ready
  useEffect(() => {
    if (fontError) throw fontError
  }, [fontError])

  // First launch check (keep existing behavior: always dispatch false)
  useEffect(() => {
    if (!loaded) return
    ;(async () => {
      const isFirst = await checkFirstLaunch()
      // keep functionality identical to your current code:
      // dispatch(setFirstLaunch(isFirst))
      dispatch(setFirstLaunch(false))
    })()
  }, [loaded, dispatch])

  // Auth bootstrap + auth Hub listener
  useEffect(() => {
    if (!loaded) return

    let isMounted = true

    const syncSignedInState = async () => {
      const session = await fetchAuthSession({ forceRefresh: true })
      const isSignedIn = !!session.tokens?.idToken
      const user = await fetchUserAttributes()

      dispatch(
        setAuthState({
          user: user || null,
          token: session.tokens?.accessToken?.toString() || null,
          isLoggedIn: isSignedIn,
        })
      )

      console.log('Auth session:', session)
    }

    const removeHubListener = Hub.listen('auth', async ({ payload }) => {
      try {
        if (payload.event === 'signedIn') {
          const session = await fetchAuthSession()
          const user = await fetchUserAttributes()

          dispatch(
            setAuthState({
              user: user || null,
              token: session.tokens?.accessToken?.toString() || null,
              isLoggedIn: true,
            })
          )
        }

        if (payload.event === 'signedOut') {
          dispatch(setAuthState({ user: null, token: null, isLoggedIn: false }))
        }
      } catch (err) {
        console.log('Auth Hub handler failed:', err)
      }
    })

    ;(async () => {
      try {
        await syncSignedInState()
      } catch (err) {
        console.log('Auth check failed:', err)
      } finally {
        if (!isMounted) return
        setChecking(false)
        await SplashScreen.hideAsync()
      }
    })()

    return () => {
      isMounted = false
      removeHubListener()
    }
  }, [loaded, dispatch])

  const ready = useMemo(() => loaded && !checking, [loaded, checking])

  if (!ready) return <FullscreenSpinner />

  return (
    <WebSocketProvider enabled={auth.isLoggedIn}>
      <Stack>
        <Stack.Protected guard={auth.isLoggedIn}>
          <Stack.Screen
            name="(app)"
            options={{ headerShown: false, gestureEnabled: false }}
          />
        </Stack.Protected>

        <Stack.Protected guard={!auth.isLoggedIn}>
          <Stack.Screen
            name="(auth)"
            options={{ headerShown: false, gestureEnabled: false }}
          />
        </Stack.Protected>
      </Stack>
    </WebSocketProvider>
  )
}
