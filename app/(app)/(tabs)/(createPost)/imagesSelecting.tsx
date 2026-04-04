import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dimensions,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { ImagePickerAsset } from 'expo-image-picker'

const { width, height } = Dimensions.get('window')
const IMAGE_SIZE = width / 3

const TOP_AREA_H = Math.round(height * 0.48)
const GRID_AREA_H = Math.round(height * 0.52)

const NEXT_ROUTE = './postDetails'

export default function InlineImagePickerScreen() {
  const router = useRouter()

  const [selected, setSelected] = useState<ImagePickerAsset[]>([])
  const selectedUris = useMemo(() => selected.map((s) => s.uri), [selected])

  useEffect(() => {
    ;(async () => {
      const perm = await ImagePicker.getMediaLibraryPermissionsAsync()
      if (!perm.granted) {
        const req = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (!req.granted) return
      }
    })()
  }, [])

  const addPhotos = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 0 as any,
      quality: 1,
    })

    if (res.canceled) return

    setSelected((prev) => {
      const seen = new Set(prev.map((p) => p.uri))
      const merged = [...prev]
      for (const a of res.assets) {
        if (!seen.has(a.uri)) {
          merged.push(a)
          seen.add(a.uri)
        }
      }
      return merged
    })
  }, [])

  const toggleSelect = useCallback((item: ImagePickerAsset) => {
    setSelected((prev) => {
      const exists = prev.some((p) => p.uri === item.uri)
      if (exists) return prev.filter((p) => p.uri !== item.uri)
      return [...prev, item]
    })
  }, [])

  const goNext = useCallback(() => {
    if (!selectedUris.length) return
    router.push({
      pathname: NEXT_ROUTE,
      params: { selectedUris: JSON.stringify(selectedUris) },
    } as any)
  }, [router, selectedUris])

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Select Photos</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={addPhotos} style={styles.addBtn}>
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={!selected.length}
            onPress={goNext}
            style={[
              styles.nextBtn,
              selected.length ? styles.nextBtnOn : styles.nextBtnOff,
            ]}
          >
            <Text
              style={[
                styles.nextBtnText,
                selected.length ? styles.nextBtnTextOn : styles.nextBtnTextOff,
              ]}
            >
              Next
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Top preview area */}
      <View style={[styles.topArea, { height: TOP_AREA_H }]}>
        {selected.length === 0 ? (
          <View style={styles.emptyPreview}>
            <Text style={styles.emptyPreviewTitle}>Select photo(s) below</Text>
            <Text style={styles.emptyPreviewSubtitle}>
              Tap Add to choose images, then tap thumbnails to remove
            </Text>

            <TouchableOpacity onPress={addPhotos} style={styles.chooseBtn}>
              <Text style={styles.chooseBtnText}>Choose Photos</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.previewWrap}>
            <FlatList
              data={selected}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(i) => i.uri}
              renderItem={({ item }) => (
                <View style={{ width: width - 32 }}>
                  <Image
                    source={{ uri: item.uri }}
                    style={{
                      width: width - 32,
                      height: TOP_AREA_H - 8,
                      borderRadius: 16,
                    }}
                    resizeMode="cover"
                  />
                </View>
              )}
            />

            <View style={styles.previewFooter}>
              <Text style={styles.previewCount}>
                {selected.length} selected
              </Text>

              <TouchableOpacity
                onPress={() => setSelected([])}
                style={styles.clearBtn}
              >
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Bottom grid */}
      <View style={{ height: GRID_AREA_H }}>
        <FlatList
          data={selected}
          numColumns={3}
          keyExtractor={(item) => item.uri}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContent}
          ListHeaderComponent={
            <View style={styles.gridHeader}>
              <Text style={styles.gridHeaderText}>
                Thumbnails of selected photos (tap to remove)
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const index = selected.findIndex((s) => s.uri === item.uri)
            const isSelected = index !== -1

            return (
              <TouchableOpacity
                onPress={() => toggleSelect(item)}
                activeOpacity={0.9}
                style={{ width: IMAGE_SIZE, height: IMAGE_SIZE }}
              >
                <Image
                  source={{ uri: item.uri }}
                  style={{
                    width: IMAGE_SIZE,
                    height: IMAGE_SIZE,
                    opacity: isSelected ? 0.75 : 1,
                  }}
                />

                {isSelected && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{index + 1}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={
            <View style={styles.gridEmpty}>
              <TouchableOpacity onPress={addPhotos} style={styles.chooseBtn}>
                <Text style={styles.chooseBtnText}>Add Photos</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },

  addBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: {
    color: '#374151',
    fontWeight: '600',
  },

  nextBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  nextBtnOn: {
    backgroundColor: '#0EA5E9', // sky-500-ish
  },
  nextBtnOff: {
    backgroundColor: '#E5E7EB', // gray-200
  },
  nextBtnText: {
    fontWeight: '600',
  },
  nextBtnTextOn: {
    color: '#FFFFFF',
  },
  nextBtnTextOff: {
    color: '#6B7280', // gray-500
  },

  // Top area
  topArea: {
    paddingHorizontal: 16,
  },

  emptyPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
  },
  emptyPreviewTitle: {
    color: '#6B7280',
  },
  emptyPreviewSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },

  chooseBtn: {
    marginTop: 16,
    borderRadius: 8,
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chooseBtnText: {
    fontWeight: '600',
    color: '#FFFFFF',
  },

  previewWrap: {
    flex: 1,
  },
  previewFooter: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewCount: {
    color: '#6B7280',
  },

  clearBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearBtnText: {
    color: '#374151',
    fontWeight: '600',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },

  // Grid
  gridContent: {
    paddingBottom: 24,
  },
  gridHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  gridHeaderText: {
    color: '#6B7280',
  },
  badge: {
    position: 'absolute',
    right: 4,
    top: 4,
    height: 24,
    width: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0EA5E9',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  gridEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
})
