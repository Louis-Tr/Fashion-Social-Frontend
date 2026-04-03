import React, { useState, useMemo } from 'react'
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  Pressable,
  Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useDispatch } from 'react-redux'
import { setFirstLaunch } from '@/store/slices/authSlice'

type Interest = { id: string; label: string; img: string }

const DATA: Interest[] = [
  { id: 'gd', label: 'Graphic Design', img: 'https://placehold.co/300x300' },
  { id: 'icon', label: 'Icon Design', img: 'https://placehold.co/300x300' },
  { id: 'uiux', label: 'UI / UX', img: 'https://placehold.co/300x300' },
  { id: 'type', label: 'Typography', img: 'https://placehold.co/300x300' },
  { id: 'logo', label: 'Logo', img: 'https://placehold.co/300x300' },
  { id: '3d', label: '3D Art', img: 'https://placehold.co/300x300' },
  { id: '4d', label: '3D Art', img: 'https://placehold.co/300x300' },
  { id: '5d', label: '3D Art', img: 'https://placehold.co/300x300' },
  { id: '6d', label: '3D Art', img: 'https://placehold.co/300x300' },
  { id: '7d', label: '3D Art', img: 'https://placehold.co/300x300' },
]

export default function WelcomeInterests() {
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const router = useRouter()
  const dispatch = useDispatch()

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected]
  )

  const toggle = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }))

  const handleSignIn = () => {
    console.log('Sign in pressed')
    dispatch(setFirstLaunch(false))
    router.replace('/signIn')
  }

  const handleContinue = () => {
    // TODO: send selectedIds to your backend or navigate
    console.log('Selected interests:', selectedIds)
    dispatch(setFirstLaunch(false))
    router.replace('/signUp')
  }

  return (
    <SafeAreaView>
      {/* Header */}
      <View></View>
    </SafeAreaView>
  )
}
