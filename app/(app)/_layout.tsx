// app/_layout.tsx
import { Stack } from 'expo-router'
import { useEffect } from 'react'

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="(story)/[id]"
        options={{
          headerShown: false,
          // Optional: fade or custom animation
          animation: 'none',
          presentation: 'card',
        }}
      />
      <Stack.Screen name="(story)/create" options={{ headerShown: false }} />
      <Stack.Screen name="(post)/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="(user)/[id]" options={{ headerShown: false }} />
    </Stack>
  )
}
