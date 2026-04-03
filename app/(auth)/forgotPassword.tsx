// app/(auth)/resetPassword.tsx
import React, { useCallback, useMemo, useState } from 'react'
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
import { confirmResetPassword, resetPassword } from 'aws-amplify/auth'

type Step = 'REQUEST' | 'CONFIRM'
const RESEND_SECONDS = 30

export default function ForgetPasswordScreen() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('REQUEST')
  const [submitting, setSubmitting] = useState(false)

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [timer, setTimer] = useState(0)

  const emailTrimmed = useMemo(() => email.trim().toLowerCase(), [email])
  const passwordOk = newPassword.length >= 8
  const passwordsMatch = newPassword === confirmPassword

  const showLoading = submitting

  const startResendTimer = useCallback(() => {
    setTimer(RESEND_SECONDS)
    const interval = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(interval)
          return 0
        }
        return t - 1
      })
    }, 1000)
  }, [])

  const onRequestCode = useCallback(async () => {
    if (!emailTrimmed) {
      alert('Please enter your email.')
      return
    }

    try {
      setSubmitting(true)
      const res = await resetPassword({ username: emailTrimmed })
      console.log('[ForgotPassword] resetPassword:', res)

      // Usually:
      // res.nextStep.resetPasswordStep === 'CONFIRM_RESET_PASSWORD_WITH_CODE'
      setStep('CONFIRM')
      startResendTimer()
      alert('We sent a verification code to your email.')
    } catch (err: any) {
      const name = err?.name || 'UnknownError'
      const message = err?.message || String(err)
      console.error('[ForgotPassword] request error:', { name, message, err })

      let friendly = 'Could not send the reset code. Please try again.'
      if (name === 'UserNotFoundException' || name === 'UserNotFound') {
        // Note: you can intentionally keep this generic for privacy, but keeping your pattern:
        friendly = 'No account found for this email.'
      } else if (
        name === 'LimitExceededException' ||
        name === 'TooManyRequestsException'
      ) {
        friendly = 'Too many requests. Please wait a moment and try again.'
      }
      alert(friendly)
    } finally {
      setSubmitting(false)
    }
  }, [emailTrimmed, startResendTimer])

  const onResend = useCallback(async () => {
    if (timer > 0) return
    await onRequestCode()
  }, [timer, onRequestCode])

  const onConfirmReset = useCallback(async () => {
    const trimmedCode = code.trim()

    if (!emailTrimmed) {
      alert('Please enter your email.')
      setStep('REQUEST')
      return
    }
    if (!trimmedCode) {
      alert('Please enter the verification code from your email.')
      return
    }
    if (!passwordOk) {
      alert('Password must be at least 8 characters.')
      return
    }
    if (!passwordsMatch) {
      alert('Passwords do not match.')
      return
    }

    try {
      setSubmitting(true)
      console.log('[ForgotPassword] confirmResetPassword for:', emailTrimmed)

      await confirmResetPassword({
        username: emailTrimmed,
        newPassword,
        confirmationCode: trimmedCode,
      })

      alert('Your password has been reset. Please sign in.')
      router.replace('/signIn')
    } catch (err: any) {
      const name = err?.name || 'UnknownError'
      const message = err?.message || String(err)
      console.error('[ForgotPassword] confirm error:', { name, message, err })

      let friendly = 'Could not reset password. Please try again.'
      if (name === 'CodeMismatchException' || name === 'CodeMismatch') {
        friendly = 'The code is incorrect. Please try again.'
      } else if (name === 'ExpiredCodeException' || name === 'ExpiredCode') {
        friendly = 'This code has expired. Tap "Resend code" to get a new one.'
      } else if (
        name === 'InvalidPasswordException' ||
        name === 'InvalidPassword'
      ) {
        friendly = 'Password doesn’t meet requirements. Try a stronger one.'
      } else if (
        name === 'LimitExceededException' ||
        name === 'TooManyRequestsException'
      ) {
        friendly = 'Too many attempts. Please wait a moment and try again.'
      }
      alert(friendly)
    } finally {
      setSubmitting(false)
    }
  }, [code, emailTrimmed, newPassword, passwordOk, passwordsMatch, router])

  const canRequest = !!emailTrimmed && !submitting
  const canConfirm =
    !!emailTrimmed &&
    !!code.trim() &&
    passwordOk &&
    passwordsMatch &&
    !submitting

  return (
    <SafeAreaView style={styles.safeArea}>
      <Modal transparent visible={showLoading} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ActivityIndicator size="large" />
            <Text style={styles.modalText}>
              {step === 'REQUEST' ? 'Sending code…' : 'Resetting password…'}
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
            <View style={styles.titleBlock}>
              <Text style={styles.title}>Forgot password</Text>
              <Text style={styles.subtitle}>
                {step === 'REQUEST'
                  ? 'Enter your email to receive a verification code.'
                  : 'Enter the code from your email and choose a new password.'}
              </Text>
            </View>

            {/* Email (always visible, so user can correct it) */}
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputOuter}>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!submitting}
                  returnKeyType="done"
                  onSubmitEditing={
                    step === 'REQUEST' ? onRequestCode : undefined
                  }
                />
              </View>
            </View>

            {step === 'REQUEST' ? (
              <>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.buttonPrimary,
                    !canRequest && styles.buttonDisabledOpacity,
                  ]}
                  onPress={onRequestCode}
                  disabled={!canRequest}
                >
                  <Text style={styles.buttonText}>Send code</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.linkBtn}
                  onPress={() => router.replace('/signIn')}
                  disabled={submitting}
                >
                  <Text style={styles.linkText}>Back to sign in</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Code */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Verification code</Text>
                  <View style={styles.inputOuter}>
                    <TextInput
                      style={styles.input}
                      value={code}
                      onChangeText={setCode}
                      placeholder="Enter the code"
                      keyboardType="number-pad"
                      autoCapitalize="none"
                      editable={!submitting}
                      returnKeyType="done"
                    />
                  </View>
                </View>

                {/* New password */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>New password</Text>
                  <View style={styles.inputOuter}>
                    <TextInput
                      style={styles.input}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="******"
                      secureTextEntry
                      autoCapitalize="none"
                      editable={!submitting}
                    />
                  </View>
                  {newPassword.length > 0 && !passwordOk && (
                    <Text style={styles.helperText}>
                      Use at least 8 characters.
                    </Text>
                  )}
                </View>

                {/* Confirm password */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Confirm new password</Text>
                  <View style={styles.inputOuter}>
                    <TextInput
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="******"
                      secureTextEntry
                      autoCapitalize="none"
                      editable={!submitting}
                      onSubmitEditing={onConfirmReset}
                    />
                  </View>
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <Text style={styles.errorText}>Passwords do not match</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.buttonPrimary,
                    !canConfirm && styles.buttonDisabledOpacity,
                  ]}
                  onPress={onConfirmReset}
                  disabled={!canConfirm}
                >
                  <Text style={styles.buttonText}>Reset password</Text>
                </TouchableOpacity>

                <View style={styles.row}>
                  <TouchableOpacity
                    style={styles.linkBtnInline}
                    onPress={onResend}
                    disabled={!canRequest || timer > 0}
                  >
                    <Text style={styles.linkText}>
                      {timer > 0 ? `Resend in ${timer}s` : 'Resend code'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.linkBtnInline}
                    onPress={() => setStep('REQUEST')}
                    disabled={submitting}
                  >
                    <Text style={styles.linkText}>Start over</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.linkBtn}
                  onPress={() => router.replace('/signIn')}
                  disabled={submitting}
                >
                  <Text style={styles.linkText}>Back to sign in</Text>
                </TouchableOpacity>
              </>
            )}
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
    rowGap: 24,
  },

  titleBlock: {
    rowGap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0B5FFF',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
  },

  fieldBlock: {
    rowGap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  inputOuter: {
    height: 48,
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
  },
  input: {
    fontSize: 16,
    color: '#000000',
  },

  helperText: {
    fontSize: 12,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
  },

  button: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
  },
  buttonPrimary: {
    backgroundColor: '#0B5FFF',
  },
  buttonDisabledOpacity: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  linkBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  linkBtnInline: {
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B5FFF',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
