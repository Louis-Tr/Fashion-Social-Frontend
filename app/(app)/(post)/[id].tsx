// app/(post)/[id].tsx
import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'

import PostItem from '@/components/Post'
import { Post } from '@/types/schemas/post'
import { Comment } from '@/types/comment'
import { fetchComment } from '@/services/posts/fetchComment'
import createComment from '@/services/posts/createComment'
import { fetchPost } from '@/services/posts/fetchPost'

export default function SinglePostScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id?: string }>()

  // Debug
  const rerenderCount = useRef(0)
  rerenderCount.current += 1
  console.log('rerender:', rerenderCount.current)

  const [post, setPost] = useState<Post | null>(null)
  const [isPostLoading, setIsPostLoading] = useState(true)

  // Comments
  const [comments, setComments] = useState<Comment[]>([])
  const [isCommentsLoading, setIsCommentsLoading] = useState(true)

  const [inputText, setInputText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<TextInput | null>(null)

  const focusCommentInput = () => {
    inputRef.current?.focus()
  }

  // Load post
  useEffect(() => {
    let alive = true

    async function loadPost(postId: string) {
      setIsPostLoading(true)
      try {
        const parsed = await fetchPost(postId)
        if (alive) setPost(parsed)
      } catch (err) {
        console.error('[SinglePost] Failed to load post', err)
        if (alive) setPost(null)
      } finally {
        if (alive) setIsPostLoading(false)
      }
    }

    if (!id) {
      setPost(null)
      setIsPostLoading(false)
      return
    }

    loadPost(String(id))

    return () => {
      alive = false
    }
  }, [id])

  // Load comments (FIXED: actually call loadComments)
  useEffect(() => {
    if (!id) return
    let alive = true

    const loadComments = async () => {
      try {
        setIsCommentsLoading(true)
        const res = await fetchComment(String(id))
        if (alive) setComments(res.comments)
      } catch (err) {
        console.error('[SinglePost] Failed to load comments', err)
        if (alive) setComments([])
      } finally {
        if (alive) setIsCommentsLoading(false)
      }
    }

    loadComments()

    return () => {
      alive = false
    }
  }, [id])

  const submitComment = async () => {
    const content = inputText.trim()
    if (!content || !post || isSubmitting) return

    try {
      setIsSubmitting(true)
      const res = await createComment(post.id, content)
      if (res.ok) {
        setComments((prev) => [res.comment, ...prev])
        setInputText('')
      }
    } catch (err) {
      console.error('[SinglePost] Failed to create comment', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!id) {
    return (
      <SafeAreaView style={styles.invalidWrap}>
        <Text>Invalid post</Text>
      </SafeAreaView>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.kb}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.backArrow}>{'<'}</Text>
          </TouchableOpacity>

          <Text style={styles.topBarTitle} numberOfLines={1}>
            {isPostLoading
              ? 'Post'
              : post?.userInfo?.displayName + "'s post" || ''}
          </Text>

          <View style={styles.topBarRight} />
        </View>
        <View style={styles.page}>
          <View style={styles.body}>
            {isPostLoading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" />
              </View>
            ) : !post ? (
              <View style={styles.center}>
                <Text>Post not found.</Text>
              </View>
            ) : (
              <>
                {/* Post */}
                <PostItem {...post} setFocusPost={focusCommentInput} />

                {/* Comments */}
                <FlatList
                  data={comments}
                  keyExtractor={(c) => c.id}
                  renderItem={({ item }) => (
                    <View style={styles.commentRow}>
                      <Text style={styles.commentAuthor}>
                        {item.user.displayName}
                      </Text>
                      <Text style={styles.commentText}>{item.content}</Text>
                    </View>
                  )}
                  ListEmptyComponent={() => {
                    if (isCommentsLoading) return null
                    return (
                      <Text style={styles.emptyText}>
                        No comments yet. Be the first to comment!
                      </Text>
                    )
                  }}
                  ListFooterComponent={
                    isCommentsLoading ? (
                      <View style={styles.footerLoading}>
                        <ActivityIndicator size="small" />
                      </View>
                    ) : null
                  }
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  style={styles.list}
                />
              </>
            )}
          </View>

          {/* Input bar */}
          <View style={styles.inputBar}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Add a comment"
              value={inputText}
              onChangeText={setInputText}
              editable={!isSubmitting}
            />
            <TouchableOpacity onPress={submitComment} disabled={isSubmitting}>
              <Text
                style={[styles.postBtn, isSubmitting && styles.postBtnDisabled]}
              >
                Post
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  kb: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  page: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
  },
  body: {
    flex: 1,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  backArrow: {
    fontSize: 20,
    fontWeight: '600',
    width: 24,
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  topBarMenu: {
    width: 24,
    textAlign: 'right',
    fontSize: 20,
    fontWeight: '700',
  },
  topBarRight: {
    width: 24,
  },

  invalidWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 80,
  },

  commentRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  commentAuthor: {
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  commentText: {
    color: '#000000',
  },

  emptyText: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#6B7280', // gray-500
  },

  footerLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB', // gray-200
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    marginRight: 12,
    fontSize: 16,
    color: '#000000',
  },
  postBtn: {
    fontWeight: '600',
    color: '#3B82F6', // blue-500
    fontSize: 16,
  },
  postBtnDisabled: {
    color: '#9CA3AF', // gray-400
  },
})
