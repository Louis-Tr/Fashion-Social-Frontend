import { Platform } from 'react-native'

export const IOS_URL = process.env.EXPO_PUBLIC_LOCALHOST_IOS
export const ANDROID_URL = process.env.EXPO_PUBLIC_LOCALHOST_ANDROID
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL

export const BASE_URL =
  API_BASE_URL ??
  Platform.select({
    ios: IOS_URL,
    android: ANDROID_URL,
    default: IOS_URL ?? ANDROID_URL,
  })

export const IOS_WS_URL = process.env.EXPO_PUBLIC_WS_URL_IOS
export const ANDROID_WS_URL = process.env.EXPO_PUBLIC_WS_URL_ANDROID
export const WS_BASE_URL = process.env.EXPO_PUBLIC_WS_URL

export const WS_URL =
  WS_BASE_URL ??
  Platform.select({
    ios: IOS_WS_URL,
    android: ANDROID_WS_URL,
    default: IOS_WS_URL ?? ANDROID_WS_URL,
  })
