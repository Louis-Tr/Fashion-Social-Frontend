// app/_layout.tsx
import { Stack } from 'expo-router'

export default function CreatePostLayout() {
  return (
    <Stack>
      <Stack.Screen name="imagesSelecting" options={{ headerShown: false }} />
      <Stack.Screen
        name="postDetails"
        options={{
          headerShown: true,
          title: 'Post Details',
        }}
      />
    </Stack>
  )
}
