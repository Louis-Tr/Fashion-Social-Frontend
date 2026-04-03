import React, { useEffect, useState } from 'react'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import Entypo from '@expo/vector-icons/Entypo'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { Tabs } from 'expo-router'
import { Image, View, ViewStyle } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '@/store/store'
import { z } from 'zod'
import { fetchMe } from '@/services/users/fetchMe'
import { urlFromKey } from '@/services/media/urlFromKey'

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name']
  color: string
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />
}

export const unstable_settings = {
  initialRouteName: 'home',
}

export const FLOATING_TAB_STYLE: ViewStyle = {
  position: 'absolute',
  bottom: 24,
  marginLeft: 16,
  marginRight: 16,
  height: 60,
  paddingTop: 4,
  borderRadius: 30,
  backgroundColor: 'black',
  shadowColor: '#000',
  shadowOpacity: 0.15,
  shadowRadius: 8,
}

export const UserProfileSchema = z.object({
  id: z.string(),
  handle: z.string(),
  displayName: z.string(),
  avatarKey: z.string().nullable(),
  bio: z.string().nullable(),
  isPrivate: z.boolean(),
  createdAt: z.string(),
  friendsCount: z.number().nonnegative(),
  postsCount: z.number().nonnegative(),
})

export type UserProfile = z.infer<typeof UserProfileSchema>

function PersonalTabIcon({ color }: { color: string }) {
  const me = useSelector((state: RootState) => state.me.me)
  const token = useSelector((state: RootState) => state.auth.token)
  const dispatch = useDispatch<AppDispatch>()
  useEffect(() => {
    // fetch only when authenticated and not already loaded
    if (!token) return
    if (me) return
    dispatch(fetchMe())
  }, [token, me, dispatch])

  const avatarUrl = me?.avatarKey ? urlFromKey(me.avatarKey) : null

  if (!avatarUrl) {
    return (
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 16,
          backgroundColor: '#ccc',
        }}
      />
    )
  }

  return (
    <Image
      source={{ uri: avatarUrl }} // now always string
      style={{ width: 24, height: 24, borderRadius: 12 }}
      resizeMode="cover"
    />
  )
}

export default function TabLayout() {
  const visible = useSelector((state: RootState) => state.tab.visible)

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: 'white',
        headerShown: false,

        // THE FIX — apply redux visibility here
        tabBarStyle: {
          ...FLOATING_TAB_STYLE,
          display: visible ? 'flex' : 'none',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Entypo name="network" size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="(createPost)"
        options={{
          title: 'Create Post',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="add-a-photo" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(message)"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons
              name="message-text-fast"
              size={28}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="personal"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <PersonalTabIcon color={color} />,
        }}
      />
    </Tabs>
  )
}
