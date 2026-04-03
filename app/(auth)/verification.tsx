import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import CoffeCup from '@/assets/illustrations/CoffeCup.svg'
import { confirmSignUp, resendSignUpCode } from 'aws-amplify/auth'

const LEN = 6
const RESEND_SECONDS = 30

export default function VerificationScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>()
  const router = useRouter()

  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [timer, setTimer] = useState(RESEND_SECONDS)

  const [code, setCode] = useState<string[]>(() => Array(LEN).fill(''))
  const inputRefs = useRef<Array<TextInput | null>>([])

  const emailStr = useMemo(
    () =>
      String(email ?? '')
        .trim()
        .toLowerCase(),
    [email]
  )
  const codeStr = useMemo(() => code.join(''), [code])
  const canSubmit = codeStr.trim().length === LEN && !!emailStr && !submitting
  const showLoading = submitting || resending

  const focus = useCallback((i: number) => {
    inputRefs.current[i]?.focus()
  }, [])

  const onChange = useCallback(
    (t: string, i: number) => {
      const d = t.replace(/\D/g, '').slice(-1)

      setCode((prev) => {
        const next = [...prev]
        next[i] = d
        return next
      })

      if (d && i < LEN - 1) focus(i + 1)
    },
    [focus]
  )

  const onKeyPress = useCallback(
    (e: any, i: number) => {
      // Backspace: if current is empty, move left and clear previous
      if (e?.nativeEvent?.key !== 'Backspace') return
      setCode((prev) => {
        const next = [...prev]
        if (next[i]) {
          next[i] = ''
          return next
        }
        if (i > 0) {
          next[i - 1] = ''
          requestAnimationFrame(() => focus(i - 1))
        }
        return next
      })
    },
    [focus]
  )

  const onSubmit = useCallback(async () => {
    const finalCode = codeStr.trim()

    if (finalCode.length !== LEN) {
      alert(`Please enter the ${LEN}-digit verification code.`)
      return
    }
    if (!emailStr) {
      alert('Missing email. Please go back and try again.')
      return
    }

    try {
      setSubmitting(true)

      await confirmSignUp({
        username: emailStr,
        confirmationCode: finalCode,
      })

      alert('Email verified. Please sign in.')
      router.replace('/signIn')
    } catch (err: any) {
      const name = err?.name || 'UnknownError'
      const message = String(err?.message || err || '')
      console.error('[Verify] confirm error:', { name, message, err })

      // Treat "already confirmed" as success
      const alreadyConfirmed =
        name === 'NotAuthorizedException' &&
        /CONFIRMED|already.*confirmed|current status/i.test(message)

      if (alreadyConfirmed) {
        alert('Email already verified. Please sign in.')
        router.replace('/signIn')
        return
      }

      let friendly = 'Verification failed. Please check the code and try again.'
      if (name === 'CodeMismatchException' || name === 'CodeMismatch') {
        friendly = 'The code is incorrect. Please try again.'
      } else if (name === 'ExpiredCodeException' || name === 'ExpiredCode') {
        friendly = 'This code has expired. Please resend a new code.'
      } else if (
        name === 'LimitExceededException' ||
        name === 'TooManyRequestsException'
      ) {
        friendly = 'Too many attempts. Please wait a moment and try again.'
      } else if (name === 'UserNotFoundException' || name === 'UserNotFound') {
        friendly = 'No account found for this email.'
      }

      alert(friendly)
    } finally {
      setSubmitting(false)
    }
  }, [codeStr, emailStr, router])

  const onResend = useCallback(async () => {
    if (timer > 0 || resending) return
    if (!emailStr) {
      alert('Missing email. Please go back and enter your email again.')
      return
    }

    try {
      setResending(true)
      await resendSignUpCode({ username: emailStr })
      alert('A new verification code has been sent.')
      setTimer(RESEND_SECONDS)
    } catch (err: any) {
      const name = err?.name || 'UnknownError'
      console.error('[Verify] resend error:', err)

      let friendly = 'Could not resend the code. Please try again.'
      if (
        name === 'TooManyRequestsException' ||
        name === 'LimitExceededException'
      ) {
        friendly = 'Too many requests. Please wait a moment and try again.'
      } else if (name === 'UserNotFoundException' || name === 'UserNotFound') {
        friendly = 'No account found for this email.'
      }

      alert(friendly)
    } finally {
      setResending(false)
    }
  }, [emailStr, resending, timer])

  useEffect(() => {
    if (timer <= 0) return
    const interval = setInterval(() => setTimer((t) => t - 1), 1000)
    return () => clearInterval(interval)
  }, [timer])

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Loading modal */}
      <Modal transparent visible={showLoading} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ActivityIndicator size="large" />
            <Text style={styles.modalText}>
              {resending ? 'Sending code…' : 'Verifying…'}
            </Text>
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.container}>
            <View style={styles.illustration}>
              <CoffeCup
                width="100%"
                height="60%"
                preserveAspectRatio="xMidYMax meet"
              />
            </View>

            <View style={styles.textBlock}>
              <Text style={styles.title}>Verify your email</Text>
              <Text style={styles.desc}>
                Enter the sign up code sent to your email
              </Text>

              <View style={styles.resendRow}>
                <Text style={styles.didntReceive}>Didn’t receive?</Text>
                <TouchableOpacity
                  onPress={onResend}
                  disabled={timer > 0 || resending}
                >
                  <Text
                    style={[
                      styles.sendAgain,
                      timer > 0
                        ? styles.sendAgainDisabled
                        : styles.sendAgainActive,
                    ]}
                  >
                    Send again
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {timer > 0 && (
              <Text style={styles.timerText}>Resend in {timer}</Text>
            )}

            {/* Code Inputs */}
            <View style={styles.codeRow}>
              {code.map((v, i) => (
                <View key={i} style={styles.codeCell}>
                  <TextInput
                    ref={(el) => {
                      inputRefs.current[i] = el
                    }}
                    value={v}
                    onChangeText={(t) => onChange(t, i)}
                    onKeyPress={(e) => onKeyPress(e, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    blurOnSubmit={false}
                    editable={!submitting && !resending}
                    style={styles.codeInput}
                    autoFocus={i === 0}
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                (!canSubmit || submitting) && styles.submitBtnDim,
              ]}
              onPress={onSubmit}
              disabled={!canSubmit}
            >
              <Text style={styles.submitBtnText}>Submit</Text>
            </TouchableOpacity>
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

  container: {
    flex: 1,
    paddingHorizontal: 32,
    paddingVertical: 32,
    rowGap: 32,
  },

  illustration: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textBlock: {
    rowGap: 16,
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0B5FFF',
  },

  desc: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
  },

  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
  },

  didntReceive: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },

  sendAgain: {
    fontSize: 16,
    fontWeight: '400',
  },
  sendAgainDisabled: {
    color: '#000000',
  },
  sendAgainActive: {
    color: '#FF0000',
  },

  timerText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },

  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },

  codeCell: {
    height: 48,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },

  codeInput: {
    height: '100%',
    width: '100%',
    textAlign: 'center',
    color: '#000000',
  },

  submitBtn: {
    height: 48,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: '#818CF8',
  },
  submitBtnDim: {
    opacity: 0.6,
  },

  submitBtnText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#FFFFFF',
  },

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
