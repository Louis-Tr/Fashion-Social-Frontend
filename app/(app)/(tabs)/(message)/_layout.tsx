// app/_layout.tsx
import { Stack } from 'expo-router'

export default function MessageLayout() {
  return (
    <Stack>
      <Stack.Screen name="message" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />

    </Stack>
  )
}
