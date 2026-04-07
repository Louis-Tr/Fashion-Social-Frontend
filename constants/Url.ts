export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/+$/,
  ''
)

export const WS_URL = API_BASE_URL
  ? `${API_BASE_URL.replace(/^http/, 'ws')}/live`
  : undefined
