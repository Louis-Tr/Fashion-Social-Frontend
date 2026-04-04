import React, { useEffect } from 'react'
import { Platform, Text, TextInput, View } from 'react-native'

export default function Probe() {
  console.log('Probe render', Platform.OS)

  useEffect(() => {
    console.log('Probe useEffect')
    return () => console.log('Probe unmount')
  }, [])

  return (
    <View style={{ flex: 1, padding: 40, backgroundColor: 'white' }}>
      <Text>Platform: {Platform.OS}</Text>
      <TextInput
        style={{ borderWidth: 1, height: 48, marginTop: 20 }}
        onLayout={() => console.log('TextInput layout')}
        ref={(node) => console.log('callback ref node:', node)}
      />
    </View>
  )
}
