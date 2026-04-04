import React, { useCallback, useMemo, useState } from 'react'
import {
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  StyleSheet,
} from 'react-native'
import { getToken } from '@/utils/token'
import {
  CreateWardRobeItemInput,
  CreateWardrobeItemReq,
  WardrobeAPI,
} from '@/services/fashion'
import * as ImagePicker from 'expo-image-picker'
import { ImagePickerAsset } from 'expo-image-picker'

/* =========================
   UI Fields
========================= */

export function TextField(props: {
  label: string
  value: string | null
  placeholder?: string
  onChange: (next: string) => void
  errorText?: string
}) {
  const { label, value, placeholder, onChange, errorText } = props
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value ?? ''}
        onChangeText={onChange}
        placeholder={placeholder}
        style={styles.textInput}
      />
      {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}
    </View>
  )
}

function NullableTextField(props: {
  label: string
  value: string | null
  placeholder?: string
  onChange: (next: string | null) => void
}) {
  const { label, value, placeholder, onChange } = props
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value ?? ''}
        onChangeText={(t) => onChange(t.trim() ? t : null)}
        placeholder={placeholder}
        style={styles.textInput}
      />
    </View>
  )
}

function ToggleField(props: {
  label: string
  value: boolean
  onChange: (next: boolean) => void
}) {
  const { label, value, onChange } = props

  return (
    <View style={styles.toggleRow}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity onPress={() => onChange(!value)} activeOpacity={0.85}>
        <View
          style={[
            styles.toggleTrack,
            { backgroundColor: value ? '#000' : '#d4d4d4' },
          ]}
        >
          <View
            style={[
              styles.toggleThumb,
              { alignSelf: value ? 'flex-end' : 'flex-start' },
            ]}
          />
        </View>
      </TouchableOpacity>
    </View>
  )
}

/* =========================
   Helpers
========================= */

const DEFAULT_DRAFT: CreateWardRobeItemInput = {
  req: {
    name: '',
    category: null,
    brand: null,
    color: null,
    size: null,
    material: null,
    season: null,
    notes: null,
    visibility: 'public',
    mediaCount: 0,
  },
  medias: [],
}

/* =========================
   Form Component
========================= */
type Item = {
  id: string
  name: string
  brand: string | null
  color: string | null
  size: string | null
  material: string | null
  season: string | null
  notes: string | null
  visibility: boolean
  presignedUrls: string[] | null
  createdAt: string
  updatedAt: string
}

export function CreateItemForm(props: { onCreated?: (item: Item) => void }) {
  const [infoOpen, setInfoOpen] = useState(true)
  const [draft, setDraft] = useState<CreateWardRobeItemInput>({
    ...DEFAULT_DRAFT,
  })

  const patchReq = useCallback((p: Partial<CreateWardrobeItemReq>) => {
    setDraft((prev) => ({ ...prev, req: { ...prev.req, ...p } }))
  }, [])

  // Example validation (kept as-is)
  const errors = useMemo(() => {
    return { name: draft.req.name.trim().length ? '' : 'Name is required' }
  }, [draft.req.name])

  const submit = useCallback(async () => {
    const api = WardrobeAPI({ getToken })
    try {
      const item = await api.createItem(draft)
      setDraft({ ...DEFAULT_DRAFT })
      props.onCreated?.(item)
    } catch (err) {
      console.error('Failed to create item:', err)
    }
  }, [draft, props])

  const addPhotos = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 0 as any,
      quality: 0.9,
    })

    if (result.canceled) return

    setDraft((prev) => {
      const seen = new Set(prev.medias.map((m) => m.uri))
      const merged = [...prev.medias]

      for (const a of result.assets) {
        if (!seen.has(a.uri)) {
          merged.push(a)
          seen.add(a.uri)
        }
      }

      return {
        ...prev,
        medias: merged,
        req: { ...prev.req, mediaCount: merged.length },
      }
    })
  }, [])

  const removePhotoAt = useCallback((idx: number) => {
    setDraft((prev) => {
      const nextMedias = prev.medias.filter((_, i) => i !== idx)
      return {
        ...prev,
        medias: nextMedias,
        req: { ...prev.req, mediaCount: nextMedias.length },
      }
    })
  }, [])

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setInfoOpen((v) => !v)}
        style={styles.collapseHeader}
      >
        <Text style={styles.helperText}>Enter item information</Text>
        <Text style={styles.helperText}>{infoOpen ? '▾' : '▸'}</Text>
      </Pressable>

      {infoOpen && (
        <View style={styles.sectionGap}>
          <TextField
            label="Name"
            value={draft.req.name}
            placeholder="e.g., Uniqlo Airism Tee"
            onChange={(name) => patchReq({ name })}
            errorText={errors.name}
          />

          <NullableTextField
            label="Category"
            value={(draft.req as any).categoryName ?? ''}
            onChange={(categoryName) =>
              patchReq({
                categoryName: categoryName || undefined,
                categoryId: undefined,
              } as any)
            }
          />

          <NullableTextField
            label="Brand"
            value={draft.req.brand ?? ''}
            onChange={(brand) => patchReq({ brand: brand || null })}
          />

          <NullableTextField
            label="Color"
            value={draft.req.color ?? ''}
            onChange={(color) => patchReq({ color: color || null })}
          />

          <NullableTextField
            label="Size"
            value={draft.req.size ?? ''}
            onChange={(size) => patchReq({ size: size || null })}
          />

          <NullableTextField
            label="Notes"
            value={draft.req.notes ?? ''}
            onChange={(notes) => patchReq({ notes: notes || null })}
          />

          <ToggleField
            label="Public"
            value={draft.req.visibility === 'public'}
            onChange={(isPublic) =>
              patchReq({ visibility: isPublic ? 'public' : 'private' })
            }
          />

          {/* Photos */}
          <View style={styles.photosBlock}>
            <View style={styles.photosHeader}>
              <Text style={styles.helperText}>Photos</Text>

              <TouchableOpacity
                onPress={addPhotos}
                style={styles.addPhotoBtn}
                activeOpacity={0.85}
              >
                <Text style={styles.addPhotoBtnText}>Add photo</Text>
              </TouchableOpacity>
            </View>

            {draft.medias.length === 0 ? (
              <Text style={styles.mutedXs}>No photos selected yet.</Text>
            ) : (
              <View style={styles.photoGrid}>
                {draft.medias.map((m, idx) => (
                  <View key={m.uri} style={styles.photoItem}>
                    <Image source={{ uri: m.uri }} style={styles.photoThumb} />
                    <TouchableOpacity
                      onPress={() => removePhotoAt(idx)}
                      style={styles.photoRemove}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.photoRemoveText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.saveBtn,
          errors.name ? styles.saveBtnError : styles.saveBtnOk,
        ]}
        onPress={submit}
        disabled={!!errors.name}
        activeOpacity={0.85}
      >
        <Text style={styles.saveBtnText}>Save</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  // container/card (gap-4 rounded-2xl border border-neutral-200 bg-white px-4)
  card: {
    gap: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },

  sectionGap: { gap: 16 },

  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },

  textInput: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d4d4d4',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
  },

  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: '#dc2626',
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  toggleTrack: {
    position: 'relative',
    height: 24,
    width: 64,
    borderRadius: 999,
    padding: 0,
    justifyContent: 'center',
  },

  toggleThumb: {
    height: 24,
    width: 24,
    borderRadius: 999,
    backgroundColor: '#fff',
  },

  photosBlock: { gap: 8 },

  photosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  helperText: { fontSize: 14, color: '#71717a' }, // zinc-500-ish
  mutedXs: { fontSize: 12, color: '#9ca3af' }, // gray-400-ish

  addPhotoBtn: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addPhotoBtnText: {
    color: '#374151',
    fontWeight: '600',
  },

  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  photoItem: {
    position: 'relative',
  },

  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },

  photoRemove: {
    position: 'absolute',
    right: -8,
    top: -8,
    height: 24,
    width: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },

  photoRemoveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 14,
  },

  saveBtn: {
    height: 48,
    width: 96,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  saveBtnOk: { backgroundColor: 'rgba(0,0,0,0.7)' },
  saveBtnError: { backgroundColor: '#dc2626' },

  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
})
