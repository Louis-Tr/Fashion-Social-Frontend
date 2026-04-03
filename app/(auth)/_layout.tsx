import { Stack } from 'expo-router'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'

export default function Layout() {
  const auth = useSelector((state: RootState) => state.auth)
  console.log('Auth state:', auth)
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Protected stack for auth.isFirstLaunch true */}
      <Stack.Protected guard={auth.isFirstLaunch}>
        <Stack.Screen
          name="index"
          options={{
            title: 'Welcome Screen',
            headerBackVisible: false,
            gestureEnabled: false,
          }}
        />
      </Stack.Protected>

      {/* Protected stack for auth.isFirstLaunch false */}
      <Stack.Protected guard={!auth.isFirstLaunch}>
        <Stack.Screen
          name="signIn"
          options={{
            title: 'Sign In',
            headerBackVisible: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="signUp"
          options={{
            title: 'Sign Up',
            headerBackVisible: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="forgotPassword"
          options={{
            title: 'Forgot Password',
            headerBackVisible: true,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="verification"
          options={{
            title: 'Verification',
            headerBackVisible: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="test"
          options={{
            title: 'Test',
            headerBackVisible: false,
            gestureEnabled: false,
          }}
        />
      </Stack.Protected>
    </Stack>
  )
}
