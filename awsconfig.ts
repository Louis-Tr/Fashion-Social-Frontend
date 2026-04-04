export const awsConfig = {
  Auth: {
    Cognito: {
      region: process.env.EXPO_PUBLIC_AWS_REGION!,
      userPoolId: process.env.EXPO_PUBLIC_USER_POOL_ID!,
      userPoolClientId: process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID!,
      loginWith: { email: true, username: false, phone: false },
    },
  },
}
