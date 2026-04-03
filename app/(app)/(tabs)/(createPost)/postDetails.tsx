import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CreateItemForm } from '@/components/Forms'
import { WardrobeAPI } from '@/services/fashion'
import { getToken } from '@/utils/token'
import { createPost } from '@/services/posts'

const { width } = Dimensions.get('window')
const PREVIEW_H = Math.round(width * 0.95)

function Chip({ text, onRemove }: { text: string; onRemove: () => void }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{text}</Text>
      <Pressable onPress={onRemove} style={styles.chipRemoveBtn}>
        <Text style={styles.chipRemoveText}>×</Text>
      </Pressable>
    </View>
  )
}

type AttachItemProps = {
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

export default function CreatePostDetailsScreen() {
  const params = useLocalSearchParams<{ selectedUris?: string }>()
  const selectedUris: string[] = useMemo(() => {
    try {
      return params.selectedUris
        ? (JSON.parse(params.selectedUris) as string[])
        : []
    } catch {
      return []
    }
  }, [params.selectedUris])

  const [activeIndex, setActiveIndex] = useState(0)
  const activeUri = selectedUris[activeIndex] ?? null

  const router = useRouter()
  const [caption, setCaption] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [visibility, setVisibility] = useState<
    'public' | 'private' | 'followers'
  >('public')

  const [itemQuery, setItemQuery] = useState('')
  const [filteredItems, setFilteredItems] = useState<AttachItemProps[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const [attachedByUri, setAttachedByUri] = useState<
    Record<string, AttachItemProps[]>
  >({})

  const attachedItemsForActive = useMemo(() => {
    if (!activeUri) return []
    return attachedByUri[activeUri] ?? []
  }, [attachedByUri, activeUri])

  const attachToActive = (item: AttachItemProps) => {
    if (!activeUri) return
    setAttachedByUri((prev) => {
      const cur = prev[activeUri] ?? []
      if (cur.some((x) => x.id === item.id)) return prev
      return { ...prev, [activeUri]: [...cur, item] }
    })
  }

  const clearAttachedFromActive = (id: string) => {
    if (!activeUri) return
    setAttachedByUri((prev) => {
      const cur = prev[activeUri] ?? []
      return { ...prev, [activeUri]: cur.filter((x) => x.id !== id) }
    })
  }

  const onCreated = (item: AttachItemProps) => {
    attachToActive(item)
    setCreateOpen(false)
  }

  const addTag = () => {
    const tag = tagInput.trim()
    if (!tag) return
    setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]))
    setTagInput('')
  }

  const submitPost = async () => {
    try {
      if (!selectedUris.length) throw new Error('No media selected.')

      const medias: Record<string, AttachItemProps[]>[] = selectedUris.map(
        (uri) => ({
          [uri]: attachedByUri[uri] ?? [],
        })
      )

      const input = {
        caption: caption.trim() ? caption.trim() : undefined,
        visibility,
        medias,
      }

      await createPost(input)
      router.replace('/(tabs)/home')
    } catch (err: any) {
      console.error('submitPost failed:', err)
      throw err
    }
  }

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 70,
  }).current

  const onViewableItemsChanged = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: Array<{ index?: number | null }>
    }) => {
      const idx = viewableItems?.[0]?.index
      if (typeof idx === 'number') setActiveIndex(idx)
    }
  ).current

  useEffect(() => {
    const api = WardrobeAPI({ getToken })
    const query = itemQuery.trim()

    if (!activeUri || query.length < 2) {
      setFilteredItems([])
      setItemsLoading(false)
      return
    }

    const ac = new AbortController()
    setItemsLoading(true)

    const t = setTimeout(async () => {
      try {
        const items = await api.searchItem(query, 5, true, ac.signal)

        const already = attachedByUri[activeUri] ?? []
        setFilteredItems(
          (items ?? []).filter(
            (it: AttachItemProps) => !already.some((a) => a.id === it.id)
          )
        )
      } catch (err: any) {
        if (err?.name !== 'AbortError') console.error(err)
      } finally {
        setItemsLoading(false)
      }
    }, 500)

    return () => {
      clearTimeout(t)
      ac.abort()
    }
  }, [itemQuery, activeUri, attachedByUri])

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Carousel */}
        <View style={styles.carouselWrap}>
          <FlatList
            data={selectedUris}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(u) => u}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            renderItem={({ item: uri, index }) => (
              <View style={{ width: width - 32 }}>
                <Image
                  source={{ uri }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
                <View style={styles.previewMeta}>
                  <Text style={styles.previewMetaText}>
                    Image {index + 1} / {selectedUris.length}
                    {index === activeIndex ? ' (selected)' : ''}
                  </Text>
                </View>
              </View>
            )}
          />
        </View>

        {/* Caption + tags */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Caption</Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Write a caption…"
            placeholderTextColor="#9CA3AF"
            style={[styles.input, styles.inputMultiline]}
            multiline
          />

          <View style={styles.tagsBlock}>
            <Text style={styles.sectionTitle}>Tags</Text>

            <View style={styles.tagRow}>
              <TextInput
                value={tagInput}
                onChangeText={setTagInput}
                placeholder="Add a tag (e.g., outfit, streetwear)"
                placeholderTextColor="#9CA3AF"
                style={[styles.input, styles.tagInput]}
                onSubmitEditing={addTag}
                returnKeyType="done"
              />
              <Pressable onPress={addTag} style={styles.addTagBtn}>
                <Text style={styles.addTagBtnText}>Add</Text>
              </Pressable>
            </View>

            {tags.length > 0 && (
              <View style={styles.chipsWrap}>
                {tags.map((t) => (
                  <Chip
                    key={t}
                    text={t}
                    onRemove={() =>
                      setTags((prev) => prev.filter((x) => x !== t))
                    }
                  />
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Attach Item */}
        <View style={[styles.section, styles.sectionAttach]}>
          <View style={styles.attachHeader}>
            <Text style={styles.sectionTitle}>
              Attach Item {activeUri ? `(for image ${activeIndex + 1})` : ''}
            </Text>

            <Pressable
              onPress={() => setCreateOpen(true)}
              style={styles.neutralBtn}
            >
              <Text style={styles.neutralBtnText}>Create new</Text>
            </Pressable>
          </View>

          {attachedItemsForActive.length > 0 ? (
            <View style={styles.attachedList}>
              {attachedItemsForActive.map((it) => (
                <View key={it.id} style={styles.attachedRow}>
                  <View style={styles.attachedRowLeft}>
                    <Text style={styles.attachedName}>{it.name}</Text>
                  </View>

                  <Pressable
                    onPress={() => clearAttachedFromActive(it.id)}
                    style={styles.removeBtn}
                  >
                    <Text style={styles.removeBtnText}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.helperText}>
              Search and attach an existing item, or create a new one.
            </Text>
          )}

          {/* Search */}
          <View style={styles.searchWrap}>
            <TextInput
              value={itemQuery}
              onChangeText={setItemQuery}
              placeholder="Search items by name or brand…"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
            />
          </View>

          {/* Results */}
          <View style={styles.resultsBox}>
            {itemsLoading ? (
              <View style={styles.resultsPad}>
                <Text style={styles.resultsHint}>Loading items…</Text>
              </View>
            ) : filteredItems.length === 0 ? (
              <View style={styles.resultsPad}>
                <Text style={styles.resultsHint}>
                  No items found. Try another search or create a new item.
                </Text>
              </View>
            ) : (
              filteredItems.slice(0, 10).map((it) => (
                <Pressable
                  key={it.id}
                  onPress={() => attachToActive(it)}
                  style={styles.resultItem}
                >
                  <Text style={styles.resultTitle}>{it.name}</Text>
                  {!!it.brand && (
                    <Text style={styles.resultSubtitle}>{it.brand}</Text>
                  )}
                </Pressable>
              ))
            )}
          </View>
        </View>

        {/* Submit */}
        <View style={styles.submitWrap}>
          <Pressable
            onPress={submitPost}
            style={({ pressed }) => [
              styles.submitBtn,
              {
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <Text style={styles.submitBtnText}>Submit Post</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Create item modal */}
      <Modal
        visible={createOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.kbAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create Item</Text>
                <Pressable
                  onPress={() => setCreateOpen(false)}
                  style={styles.modalCloseBtn}
                >
                  <Text style={styles.modalCloseText}>Close</Text>
                </Pressable>
              </View>

              {/* Body */}
              <ScrollView
                style={styles.modalBody}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.modalBodyContent}
              >
                <CreateItemForm onCreated={onCreated} />
              </ScrollView>

              {/* Footer */}
              <View style={styles.modalFooter}>
                <Pressable
                  onPress={() => {
                    setCreateOpen(false)
                  }}
                  style={styles.modalSaveBtn}
                >
                  <Text style={styles.modalSaveText}>Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingBottom: 80, // pb-20
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // Carousel
  carouselWrap: {
    paddingHorizontal: 16, // px-4
    paddingTop: 8, // pt-2
  },
  previewImage: {
    width: width - 32,
    height: PREVIEW_H,
    borderRadius: 24,
  },
  previewMeta: {
    marginTop: 8,
    alignItems: 'center',
  },
  previewMetaText: {
    fontSize: 12,
    color: '#71717A', // zinc-500
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionAttach: {
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },

  // Inputs
  input: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D4D4D8', // neutral-300-ish
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#000000',
  },
  inputMultiline: {
    textAlignVertical: 'top',
  },

  // Tags
  tagsBlock: {
    marginTop: 16,
  },
  tagRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  tagInput: {
    flex: 1,
    marginTop: 0,
  },
  addTagBtn: {
    borderRadius: 16,
    backgroundColor: '#E5E7EB', // neutral-200-ish
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addTagBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.7)',
  },

  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: '#F3F4F6', // gray-100
    marginRight: 8,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    color: '#1F2937', // gray-800
    fontSize: 14,
    fontWeight: '600',
  },
  chipRemoveBtn: {
    marginLeft: 8,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipRemoveText: {
    color: '#6B7280', // gray-500
    fontSize: 14,
    fontWeight: '700',
  },

  // Attach header
  attachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  neutralBtn: {
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  neutralBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.7)',
  },

  // Attached items
  attachedList: {
    marginTop: 12,
    rowGap: 8,
  },
  attachedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D4D4D8',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  attachedRowLeft: {
    flex: 1,
  },
  attachedName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  removeBtn: {
    marginLeft: 12,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  removeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#71717A', // zinc-500
  },
  helperText: {
    marginTop: 8,
    fontSize: 14,
    color: '#71717A',
  },

  // Search + results
  searchWrap: {
    marginTop: 12,
  },
  resultsBox: {
    marginTop: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB', // neutral-200
    overflow: 'hidden',
  },
  resultsPad: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  resultsHint: {
    fontSize: 14,
    color: '#71717A',
  },
  resultItem: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  resultSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#71717A',
  },

  // Submit
  submitWrap: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  submitBtn: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#000000',
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Modal
  kbAvoid: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 16,
  },
  modalCard: {
    marginTop: 40,
    flex: 1,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  modalCloseBtn: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#71717A',
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 16,
    paddingBottom: 120,
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 16,
  },
  modalSaveBtn: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#000000',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
})
