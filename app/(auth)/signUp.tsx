// app/(auth)/signUp.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { signUp } from 'aws-amplify/auth'
import { API_BASE_URL } from '@/constants/Url'

// ---------------- Types ----------------
type Prediction = {
  placeId: string
  text: string
  mainText: string
  secondaryText: string
  types: string[]
}

type PlacesAutocompleteResponse = {
  status: string
  predictions?: Prediction[]
  error_message?: string
}

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL

// ---------------- Helpers ----------------
function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

function zero2(n: string) {
  return n.padStart(2, '0')
}

export default function SignUpScreen() {
  const router = useRouter()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [gender, setGender] = useState('')
  const options = ['Male', 'Female', 'Other']

  const [address, setAddress] = useState('') // final selected address
  const [query, setQuery] = useState('') // text in the input

  const [dd, setDd] = useState('')
  const [mm, setMm] = useState('')
  const [yyyy, setYyyy] = useState('')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [results, setResults] = useState<Prediction[]>([])
  const [placesError, setPlacesError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  const [handle, setHandle] = useState('')
  const [handleStatus, setHandleStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error'
  >('idle')

  // Debounce query for Places calls
  const debouncedQuery = useDebouncedValue(query, 250)
  const skipNextPlacesFetchRef = useRef(false)

  // Debounce handle
  const debouncedHandle = useDebouncedValue(handle, 300)
  const normalizeHandle = (h: string) =>
    h
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 32)

  const isHandleValid = (h: string) => /^[a-z0-9_]{3,32}$/.test(h)

  const checkHandleAvailability = async (h: string): Promise<boolean> => {
    if (!API_BASE_URL) throw new Error('Missing EXPO_PUBLIC_API_BASE_URL')

    const res = await fetch(
      `${API_BASE_URL}/handle?handle=${encodeURIComponent(h)}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      }
    )

    const json = await res.json()
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error || 'Handle check failed')
    }

    return Boolean(json.unique) // true => available
  }

  useEffect(() => {
    const h = normalizeHandle(debouncedHandle)

    if (!h) {
      setHandleStatus('idle')
      return
    }

    if (!isHandleValid(h)) {
      setHandleStatus('invalid')
      return
    }

    let mounted = true
    setHandleStatus('checking')
    ;(async () => {
      try {
        const available = await checkHandleAvailability(h)
        if (!mounted) return
        setHandleStatus(available ? 'available' : 'taken')
      } catch {
        if (!mounted) return
        setHandleStatus('error')
      }
    })()

    return () => {
      mounted = false
    }
  }, [debouncedHandle])

  // Abort previous fetch to prevent race conditions
  const abortRef = useRef<AbortController | null>(null)

  // Optional: session token (recommended for Places Autocomplete billing/relevance)
  const [sessionToken, setSessionToken] = useState(() => String(Date.now()))
  const resetSessionToken = () => setSessionToken(String(Date.now()))

  const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY

  // ----- DOB focus refs (simple useRef array) -----
  const dobRefs = useRef<Array<TextInput | null>>([])
  const focusDob = (i: number) => dobRefs.current[i]?.focus()

  const fetchPlaces = async (input: string): Promise<Prediction[]> => {
    const trimmed = input.trim()
    if (!trimmed) return []

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsSearching(true)
    setPlacesError(null)

    try {
      const url = `${API_BASE_URL}/places?input=${encodeURIComponent(trimmed)}`

      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        setPlacesError(text || 'Failed to fetch places')
        return []
      }

      const json = (await res.json()) as {
        places?: Prediction[]
      }

      console.log('[Auth] fetchPlaces result:', json)

      return json.places ?? []
    } catch (err: any) {
      if (err?.name === 'AbortError') return []
      setPlacesError(err?.message ?? 'Failed to fetch places')
      return []
    } finally {
      setIsSearching(false)
    }
  }

  // Trigger Places search when debouncedQuery changes
  useEffect(() => {
    const q = (debouncedQuery ?? '').trim()
    if (skipNextPlacesFetchRef.current) {
      skipNextPlacesFetchRef.current = false
      return
    }

    if (q.length <= 2) {
      setResults([])
      setPlacesError(null)
      return
    }

    let mounted = true
    ;(async () => {
      const preds = await fetchPlaces(q)
      if (!mounted) return
      setResults(preds)
    })()

    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, sessionToken])

  const onPickAddress = (p: Prediction) => {
    skipNextPlacesFetchRef.current = true
    setQuery(p.text)
    setAddress(p.text)
    setResults([])
    setPlacesError(null)
    resetSessionToken()
    Keyboard.dismiss()
  }

  const onChangeDd = (text: string) => {
    const v = text.replace(/[^0-9]/g, '').slice(0, 2)
    setDd(v)
    if (v.length === 2) focusDob(1)
  }

  const onChangeMm = (text: string) => {
    const v = text.replace(/[^0-9]/g, '').slice(0, 2)
    setMm(v)
    if (v.length === 2) focusDob(2)
  }

  const onChangeYyyy = (text: string) => {
    const v = text.replace(/[^0-9]/g, '').slice(0, 4)
    setYyyy(v)
  }

  // Add these key handlers
  const onKeyPressDd = (e: any) => {
    // nothing to go back to
  }

  const onKeyPressMm = (e: any) => {
    if (e?.nativeEvent?.key === 'Backspace' && !mm) {
      focusDob(0)
    }
  }

  const onKeyPressYyyy = (e: any) => {
    if (e?.nativeEvent?.key === 'Backspace' && !yyyy) {
      focusDob(1)
    }
  }

  const onSignUp = async () => {
    const firstNameTrim = (firstName ?? '').trim()
    const lastNameTrim = (lastName ?? '').trim()
    const emailTrim = (email ?? '').trim().toLowerCase()
    const g = (gender ?? '').trim()
    const addr = (address ?? query ?? '').trim()
    const d = (dd ?? '').replace(/\D/g, '')
    const m = (mm ?? '').replace(/\D/g, '')
    const y = (yyyy ?? '').replace(/\D/g, '')

    if (!firstNameTrim) return alert('Please enter your first name.')
    if (!lastNameTrim) return alert('Please enter your last name.')
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      return alert('Please enter a valid email.')
    }
    const handleTrim = normalizeHandle(handle)

    if (!handleTrim) return alert('Please choose a handle.')
    if (!isHandleValid(handleTrim)) {
      return alert('Handle must be 3–32 chars (letters/numbers/underscore).')
    }
    if (handleStatus !== 'available') {
      return alert('Please choose an available handle.')
    }
    if (!g) return alert('Please select your gender.')
    if (!addr) return alert('Please enter your address.')

    if (y.length !== 4 || m.length < 1 || d.length < 1) {
      return alert('Please enter a valid date of birth (YYYY-MM-DD).')
    }
    const mmP = parseInt(m, 10)
    const ddP = parseInt(d, 10)
    const yyyyP = parseInt(y, 10)
    if (mmP < 1 || mmP > 12) return alert('Month must be 1–12.')
    const daysInMonth = new Date(yyyyP, mmP, 0).getDate()
    if (ddP < 1 || ddP > daysInMonth) {
      return alert(`Day must be 1–${daysInMonth}.`)
    }

    const birthdate = `${yyyyP}-${zero2(String(mmP))}-${zero2(String(ddP))}`

    if (!password)
      return alert('Please enter a password to create your account.')
    if (password !== confirmPassword) return alert('Passwords do not match.')

    try {
      const res = await signUp({
        username: emailTrim,
        password,
        options: {
          userAttributes: {
            email: emailTrim,
            given_name: firstNameTrim,
            family_name: lastNameTrim,
            name: `${firstNameTrim} ${lastNameTrim}`,
            gender: g,
            address: addr,
            birthdate,
            'custom:handle': handleTrim, // ✅ required by your PostConfirmation lambda
          },
        },
      })

      console.log('[Auth] signUp result:', res)
      router.replace({
        pathname: '/verification',
        params: { type: 'signup', email: emailTrim },
      })
    } catch (err: any) {
      const name = err?.name || 'UnknownError'
      const message = err?.message || String(err)
      console.error('[Auth] signUp error:', { name, message, err })

      let friendly = 'Failed to sign up. Please try again.'
      if (name === 'UsernameExistsException' || name === 'UsernameExists') {
        friendly = 'An account with this email already exists.'
      } else if (
        name === 'InvalidPasswordException' ||
        name === 'InvalidPassword'
      ) {
        friendly = 'Password doesn’t meet requirements. Try a stronger one.'
      } else if (name === 'InvalidParameterException') {
        friendly = 'Some information looks invalid. Please review your details.'
      }
      alert(friendly)
    }
  }

  const onSignIn = () => router.replace('/signIn')

  const addressHelper = useMemo(() => {
    if (placesError) return placesError
    if (
      isSearching &&
      (query.trim().length > 2 || debouncedQuery.trim().length > 2)
    )
      return 'Searching...'
    return null
  }, [placesError, isSearching, query, debouncedQuery])

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.headerBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.titleBlue}>Sign up </Text>
            <Text style={styles.titleBlack}>to stay tuned!!</Text>
          </View>
        </View>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.container}>
              {/* First name */}
              <View style={styles.fieldBlock}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>First name</Text>
                </View>
                <View style={styles.inputOuter}>
                  <TextInput
                    style={styles.input}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Your name"
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Last name */}
              <View style={styles.fieldBlock}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Last name</Text>
                </View>
                <View style={styles.inputOuter}>
                  <TextInput
                    style={styles.input}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Your name"
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Email */}
              <View style={styles.fieldBlock}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Email</Text>
                </View>
                <View style={styles.inputOuter}>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Your email"
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Handle</Text>
                </View>

                <View style={styles.inputOuter}>
                  <TextInput
                    style={styles.input}
                    value={handle}
                    onChangeText={(t) => setHandle(normalizeHandle(t))}
                    placeholder="your_handle"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {handleStatus === 'checking' && (
                  <Text style={styles.helperText}>Checking…</Text>
                )}
                {handleStatus === 'available' && (
                  <Text style={styles.helperOk}>Available</Text>
                )}
                {handleStatus === 'taken' && (
                  <Text style={styles.helperBad}>That handle is taken</Text>
                )}
                {handleStatus === 'invalid' && (
                  <Text style={styles.helperBad}>
                    3–32 chars, lowercase letters, numbers, underscore
                  </Text>
                )}
                {handleStatus === 'error' && (
                  <Text style={styles.helperBad}>
                    Could not check handle right now
                  </Text>
                )}
              </View>

              {/* Address + suggestions (NO FlatList) */}
              <View style={styles.fieldBlock}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Address</Text>
                </View>

                <View style={styles.addressOuter}>
                  <TextInput
                    style={styles.addressInput}
                    placeholder="Enter address"
                    value={query}
                    onChangeText={(t) => {
                      setQuery(t)
                      setAddress(t)
                    }}
                    autoCorrect={false}
                  />
                </View>

                {!!addressHelper && (
                  <Text style={styles.helperText}>{addressHelper}</Text>
                )}

                {results.length > 0 && (
                  <View style={styles.suggestionsBox}>
                    {results.map((item, index) => (
                      <TouchableOpacity
                        key={item.placeId}
                        onPress={() => onPickAddress(item)}
                        style={[
                          styles.suggestionItem,
                          index === results.length - 1 &&
                            styles.suggestionItemLast,
                        ]}
                        activeOpacity={0.7}
                      >
                        <View style={styles.suggestionContent}>
                          <Text style={styles.suggestionMainText}>
                            {item.mainText}
                          </Text>
                          <Text style={styles.suggestionSecondaryText}>
                            {item.secondaryText}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* DOB (with focus logic) */}
              <View style={styles.fieldBlock}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Date of birth</Text>
                </View>

                <View style={styles.dobRow}>
                  <View style={styles.dobCell}>
                    <TextInput
                      ref={(el) => {
                        dobRefs.current[0] = el
                      }}
                      style={styles.dobInput}
                      keyboardType="numeric"
                      value={dd}
                      onChangeText={onChangeDd}
                      onKeyPress={onKeyPressDd}
                      placeholder="DD"
                      maxLength={2}
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.dobCell}>
                    <TextInput
                      ref={(el) => {
                        dobRefs.current[1] = el
                      }}
                      style={styles.dobInput}
                      keyboardType="numeric"
                      value={mm}
                      onChangeText={onChangeMm}
                      onKeyPress={onKeyPressMm}
                      placeholder="MM"
                      maxLength={2}
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.dobCell}>
                    <TextInput
                      ref={(el) => {
                        dobRefs.current[2] = el
                      }}
                      style={styles.dobInput}
                      keyboardType="numeric"
                      value={yyyy}
                      onChangeText={onChangeYyyy}
                      onKeyPress={onKeyPressYyyy}
                      placeholder="YYYY"
                      maxLength={4}
                      returnKeyType="done"
                    />
                  </View>
                </View>
                
              </View>

              {/* Password */}
              <View style={styles.fieldBlockTight}>
                <Text style={styles.passwordLabel}>New password</Text>
                <View style={styles.passwordOuter}>
                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="******"
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Confirm password */}
              <View style={styles.fieldBlockTight}>
                <Text style={styles.passwordLabel}>Confirm new password</Text>
                <View style={styles.passwordOuter}>
                  <TextInput
                    style={styles.passwordInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="******"
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Footer */}
              <View style={styles.footerRow}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <TouchableOpacity onPress={onSignIn} activeOpacity={0.7}>
                  <Text style={styles.footerLink}>Sign in</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.signUpBtn}
                onPress={onSignUp}
                activeOpacity={0.85}
              >
                <Text style={styles.signUpBtnText}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
  scroll: {
    flex: 1,
  },
  helperOk: {
    fontSize: 12,
    color: '#16A34A',
  },
  helperBad: {
    fontSize: 12,
    color: '#DC2626',
  },

  container: {
    width: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 32,
    paddingVertical: 16,
    rowGap: 16,
  },

  headerBlock: {
    width: '100%',
    rowGap: 16,
    paddingHorizontal: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleBlue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#7797DB',
  },
  titleBlack: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },

  fieldBlock: {
    width: '100%',
    rowGap: 8,
  },
  labelRow: {
    width: '100%',
    alignItems: 'flex-start',
  },
  label: {
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

  addressOuter: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addressInput: {
    height: 48,
    width: '100%',
    color: '#000000',
  },

  helperText: {
    fontSize: 12,
    color: '#71717A',
  },

  suggestionsBox: {
    width: '100%',
    marginTop: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },

  suggestionItem: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionText: {
    color: '#000000',
  },

  dobRow: {
    height: 48,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  dobCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 16,
  },
  dobInput: {
    height: '100%',
    width: '100%',
    textAlign: 'center',
    color: '#000000',
  },

  genderRow: {
    height: 48,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  genderPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  genderPillSelected: {
    backgroundColor: '#818CF8',
  },
  genderPillUnselected: {
    backgroundColor: '#F4F4F5',
  },
  genderTextSelected: {
    color: '#FFFFFF',
  },
  genderText: {
    color: '#000000',
  },

  fieldBlockTight: {
    width: '100%',
    rowGap: 8,
  },
  passwordLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  passwordOuter: {
    height: 48,
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
  },
  passwordInput: {
    fontSize: 16,
    color: '#000000',
  },

  footerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  footerText: {
    fontWeight: '700',
    color: '#000000',
    opacity: 0.5,
  },
  footerLink: {
    fontWeight: '700',
    color: '#FF0000',
    opacity: 0.5,
  },

  signUpBtn: {
    height: 48,
    width: '90%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: '#0B5FFF',
    marginBottom: 32,
    alignSelf: 'center',
  },
  signUpBtnText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#FFFFFF',
  },

  suggestionItemLast: {
    borderBottomWidth: 0,
  },

  suggestionContent: {
    width: '100%',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  suggestionMainText: {
    width: '100%',
    textAlign: 'left',
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },

  suggestionSecondaryText: {
    width: '100%',
    marginTop: 2,
    textAlign: 'left',
    fontSize: 12,
    color: '#6B7280',
  },
})
