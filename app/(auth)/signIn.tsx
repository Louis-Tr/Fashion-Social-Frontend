import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useDispatch } from 'react-redux'
import { fetchAuthSession, signIn } from 'aws-amplify/auth'

import CoffeCup from '@/assets/illustrations/CoffeCup.svg'
import { setAuthState } from '@/store/slices/authSlice'

export default function SignInScreen() {
  const router = useRouter()
  const dispatch = useDispatch()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAuthed, setIsAuthed] = useState(false) // used to gate routing until session/tokens are set

  const emailTrimmed = useMemo(
    () => (email ?? '').trim().toLowerCase(),
    [email]
  )
  const canSubmit = !!emailTrimmed && !!password && !isSubmitting

  // Prevent double taps / concurrent sign-in
  const inFlightRef = useRef(false)

  const routeToSignUp = useCallback(() => router.replace('/signUp'), [router])
  const routeToForgot = useCallback(
    () => router.replace('/forgotPassword'),
    [router]
  )

  const finishSignedIn = useCallback(
    async (fallbackSub: string) => {
      // Force refresh ensures tokens are actually minted/available right after signIn
      const session = await fetchAuthSession({ forceRefresh: true })

      const accessToken = session.tokens?.accessToken?.toString() ?? null
      const idToken = session.tokens?.idToken?.toString() ?? null
      const token = accessToken ?? idToken

      if (!token) throw new Error('Signed in but missing token')

      dispatch(
        setAuthState({
          user: { sub: session.userSub ?? fallbackSub },
          token,
          isLoggedIn: true,
          payload: session.tokens?.idToken?.payload,
        })
      )

      // ✅ Gate routing until Redux state is updated and tokens exist
      setIsAuthed(true)
    },
    [dispatch]
  )

  const onSignIn = useCallback(async () => {
    if (!canSubmit) return
    if (inFlightRef.current) return
    inFlightRef.current = true

    try {
      setIsSubmitting(true)

      if (!emailTrimmed || !password) {
        alert('Please enter both email and password.')
        return
      }

      const res = await signIn({
        username: emailTrimmed,
        password,
        options: { authFlowType: 'USER_PASSWORD_AUTH' },
      })

      console.log('[Auth] signIn:', res)

      if (!res.isSignedIn) {
        const step = res.nextStep?.signInStep
        console.log('[Auth] next step:', step, res.nextStep)

        switch (step) {
          case 'DONE':
            // Uncommon, but keep identical handling
            return

          case 'CONFIRM_SIGN_UP':
            alert('Please verify your email to continue.')
            router.replace({
              pathname: '/verification',
              params: { type: 'signup', email: emailTrimmed },
            })
            return

          default:
            alert('Additional verification is required to complete sign in.')
            return
        }
      }

      // ✅ Signed in: ensure tokens exist + set redux auth state
      await finishSignedIn(emailTrimmed)

      // ✅ Optional: you can route immediately here,
      // but if your RootLayout guards already handle it, you can omit this.
      // Keeping it explicit improves perceived responsiveness.
      router.replace('/(app)/(tabs)/home')
    } catch (err: any) {
      const name = err?.name || 'UnknownError'
      const message = err?.message || String(err)
      console.error('[Auth] sign in error:', { name, message, err })

      let friendly = 'Failed to sign in. Please try again.'
      if (name === 'UserNotFoundException' || name === 'UserNotFound') {
        friendly = 'No account found for this email.'
      } else if (
        name === 'NotAuthorizedException' ||
        name === 'NotAuthorized'
      ) {
        friendly = 'Incorrect email or password.'
      } else if (
        name === 'UserNotConfirmedException' ||
        name === 'UserNotConfirmed'
      ) {
        friendly =
          'Your account isn’t confirmed yet. Check your email for the code.'
      }

      alert(friendly)
    } finally {
      setIsSubmitting(false)
      inFlightRef.current = false
    }
  }, [canSubmit, emailTrimmed, password, finishSignedIn, router])

  const showLoading = isSubmitting && !isAuthed

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Loading modal blocks touches and prevents the user from navigating mid-auth */}
      <Modal transparent visible={showLoading} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ActivityIndicator size="large" />
            <Text style={styles.modalText}>Signing you in…</Text>
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.root}>
            <View style={styles.illustrationContainer}>
              <CoffeCup
                width="100%"
                height="60%"
                preserveAspectRatio="xMidYMax meet"
              />
            </View>

            <View style={styles.formContainer}>
              <View style={styles.headerBlock}>
                <View style={styles.titleRow}>
                  <Text style={styles.titlePrimary}>Sign in </Text>
                  <Text style={styles.titleBlack}>to heal your mind!!</Text>
                </View>

                <View>
                  <Text style={styles.subtitleText}>
                    Don&apos;t have an account yet?
                  </Text>
                  <TouchableOpacity
                    style={styles.selfStart}
                    onPress={routeToSignUp}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.signUpLink}>Sign up here</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>Email address</Text>
                </View>
                <View style={styles.inputOuter}>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Your email address"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    editable={!isSubmitting}
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>Password</Text>
                </View>
                <View style={styles.inputOuter}>
                  <TextInput
                    style={styles.input}
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    placeholder="********"
                    textContentType="password"
                    editable={!isSubmitting}
                    returnKeyType="done"
                    onSubmitEditing={onSignIn}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.forgotRow}
                onPress={routeToForgot}
                disabled={isSubmitting}
              >
                <Text style={styles.forgotText}>Forgot password</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.signInBtn,
                  (!canSubmit || isSubmitting) && styles.signInBtnDisabled,
                ]}
                onPress={onSignIn}
                disabled={!canSubmit}
              >
                {isSubmitting ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={styles.signInBtnText}>Sign in</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoid: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  root: {
    flex: 1,
  },

  illustrationContainer: {
    flex: 1,
    paddingHorizontal: 32,
  },

  formContainer: {
    width: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 32,
    paddingVertical: 32,
    rowGap: 32,
  },

  headerBlock: {
    width: '100%',
    rowGap: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  titlePrimary: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0B5FFF',
  },
  titleBlack: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  subtitleText: {
    fontSize: 20,
    color: '#000000',
  },
  selfStart: {
    alignSelf: 'flex-start',
  },
  signUpLink: {
    fontSize: 20,
    color: '#FF0000',
  },

  fieldBlock: {
    width: '100%',
    rowGap: 8,
  },
  fieldLabelRow: {
    width: '100%',
    alignItems: 'flex-start',
  },
  fieldLabel: {
    fontSize: 20,
    fontWeight: '500',
    color: '#000000',
  },

  inputOuter: {
    height: 48,
    width: '100%',
    alignItems: 'flex-start',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 16,
  },
  input: {
    height: '100%',
    width: '100%',
    color: '#000000',
  },

  forgotRow: {
    width: '100%',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  forgotText: {
    fontWeight: '700',
    color: '#000000',
    opacity: 0.5,
  },

  signInBtn: {
    height: 48,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: '#0B5FFF',
  },
  signInBtnDisabled: {
    opacity: 0.6,
  },
  signInBtnText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#FFFFFF',
  },

  // Loading modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 20,
    alignItems: 'center',
    rowGap: 12,
  },
  modalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
})
