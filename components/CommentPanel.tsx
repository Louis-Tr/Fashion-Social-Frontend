import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Heart, MessageCircle, X } from 'lucide-react-native'
import { Comment } from '@/types/comment'
import createComment from '@/services/posts/createComment'
import { toggleCommentReaction } from '@/services/posts/reaction'
import { fetchCommentReplies } from '@/services/posts/fetchComment'
import deleteComment from '@/services/posts/deleteComment'
import { useStore } from 'react-redux'
import { getUser } from '@/utils/getUser'
import { router } from 'expo-router'

interface Props {
  focusPost: string | null
  onClose: () => void
  comments: Comment[]
  isLoading: boolean
  onAddComment: (comment: Comment) => void
  onDeleteComment: (commentId: string) => void
}

// ---------- time formatting ----------
function formatTimeAgo(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return date.toLocaleDateString()
}

// ---------- PLACEHOLDER: implement later ----------
/**
 * Fetch replies for a given parent comment.
 * Expected: returns ONLY replies (children), sorted how you want (e.g. newest first).
 *
 * Example endpoint ideas:
 * - GET /posts/:postId/comments?parentId=:parentId&limit=...
 * - GET /posts/:postId/comments/:parentId/replies
 */

export default function CommentPanel({
  focusPost,
  onClose,
  comments,
  isLoading,
  onAddComment,
  onDeleteComment,
}: Props) {
  const [parentHeight, setParentHeight] = useState(0)

  const topLevelComments = comments.filter(
    (c: any) => !c.parentId && !c.parent_id
  )

  // Animation values
  const translateY = useSharedValue(0)
  const backdropOpacity = useSharedValue(0)

  // Top-level comment input
  const [inputText, setInputText] = useState('')

  // UI state for likes (client-side optimistic)
  const [likedById, setLikedById] = useState<Record<string, boolean>>({})
  const [likeCountById, setLikeCountById] = useState<Record<string, number>>({})

  // Reply UI
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [repliesByParentId, setRepliesByParentId] = useState<
    Record<string, Comment[]>
  >({})
  const [repliesOpenByParentId, setRepliesOpenByParentId] = useState<
    Record<string, boolean>
  >({})
  const [loadingRepliesByParentId, setLoadingRepliesByParentId] = useState<
    Record<string, boolean>
  >({})

  // OPTIONAL: track reply counts explicitly (so you can update on submitReply, etc.)
  const [replyCountById, setReplyCountById] = useState<Record<string, number>>(
    {}
  )

  // add near your component state
  const [commentActionVisible, setCommentActionVisible] = useState(false)
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null)

  const openCommentActions = (comment: Comment) => {
    setSelectedComment(comment)
    const user = getUser()
    console.log('user', user?.sub)
    console.log('comment', comment.user.id)
    if (user?.sub === comment.user.id) {
      setCommentActionVisible(true)
    } else {
      Alert.alert('Error', 'You cannot edit this comment.')
    }
  }

  const closeCommentActions = () => {
    setCommentActionVisible(false)
    setSelectedComment(null)
  }

  const handleDeleteComment = async () => {
    if (!selectedComment) return

    const deletingId = selectedComment.id

    try {
      closeCommentActions()
      if (!focusPost) return
      const ok = await deleteComment(focusPost, deletingId)

      if (!ok) {
        Alert.alert('Error', 'Failed to delete comment.')
        return
      }

      onDeleteComment(deletingId)

      setLikedById((prev) => {
        const copy = { ...prev }
        delete copy[deletingId]
        return copy
      })

      setLikeCountById((prev) => {
        const copy = { ...prev }
        delete copy[deletingId]
        return copy
      })

      setReplyCountById((prev) => {
        const copy = { ...prev }
        delete copy[deletingId]
        return copy
      })

      setRepliesOpenByParentId((prev) => {
        const copy = { ...prev }
        delete copy[deletingId]
        return copy
      })

      setRepliesByParentId((prev) => {
        const copy = { ...prev }
        delete copy[deletingId]
        return copy
      })

      setLoadingRepliesByParentId((prev) => {
        const copy = { ...prev }
        delete copy[deletingId]
        return copy
      })

      if (replyingToId === deletingId) {
        setReplyingToId(null)
        setReplyText('')
      }

      // if the deleted comment was a reply, also remove it from loaded reply lists
      setRepliesByParentId((prev) => {
        const next: Record<string, Comment[]> = {}

        for (const key of Object.keys(prev)) {
          next[key] = prev[key].filter((r) => r.id !== deletingId)
        }

        return next
      })
    } catch (error) {
      console.error(error)
      Alert.alert('Error', 'Failed to delete comment.')
    }
  }

  // Hydrate counts from incoming comments once
  useEffect(() => {
    const nextLikeCounts: Record<string, number> = {}
    const nextReplyCounts: Record<string, number> = {}

    for (const c of comments) {
      const anyC = c as any

      // likes
      if (typeof anyC.reactions === 'number')
        nextLikeCounts[c.id] = anyC.reactions
      else if (typeof anyC.reaction_count === 'number')
        nextLikeCounts[c.id] = anyC.reaction_count
      else nextLikeCounts[c.id] = nextLikeCounts[c.id] ?? 0

      // replies
      if (typeof anyC.replies === 'number') nextReplyCounts[c.id] = anyC.replies
      else if (typeof anyC.reply_count === 'number')
        nextReplyCounts[c.id] = anyC.reply_count
      else nextReplyCounts[c.id] = nextReplyCounts[c.id] ?? 0
    }

    setLikeCountById((prev) => ({ ...nextLikeCounts, ...prev }))
    setReplyCountById((prev) => ({ ...nextReplyCounts, ...prev }))
  }, [comments])

  const submitComment = async () => {
    const content = inputText.trim()
    if (!content) {
      Alert.alert('Empty comment', 'Please enter a comment.')
      return
    }
    if (!focusPost) return

    try {
      const res = await createComment(focusPost, content)
      if (res.ok) {
        onAddComment(res.comment)
        setInputText('')
      } else {
        Alert.alert('Error', 'Failed to create comment.')
      }
    } catch (e) {
      console.error(e)
      Alert.alert('Error', 'Failed to create comment.')
    }
  }

  const onPressLike = async (commentId: string) => {
    if (!focusPost) return
    const postId = focusPost

    const current = !!likedById[commentId]
    const next = !current

    // optimistic UI
    setLikedById((prev) => ({ ...prev, [commentId]: next }))
    setLikeCountById((prev) => ({
      ...prev,
      [commentId]: Math.max(0, (prev[commentId] ?? 0) + (next ? 1 : -1)),
    }))

    try {
      const res = await toggleCommentReaction(postId, commentId)
      if (res?.ok !== true) throw new Error('toggle failed')

      const serverIsLiked = !!res.isLiked
      if (serverIsLiked === next) return

      // reconcile
      setLikedById((prev) => ({ ...prev, [commentId]: serverIsLiked }))
      setLikeCountById((prev) => ({
        ...prev,
        [commentId]: Math.max(
          0,
          (prev[commentId] ?? 0) + (serverIsLiked ? 1 : -1) - (next ? 1 : -1)
        ),
      }))
    } catch (e) {
      // rollback
      setLikedById((prev) => ({ ...prev, [commentId]: current }))
      setLikeCountById((prev) => ({
        ...prev,
        [commentId]: Math.max(
          0,
          (prev[commentId] ?? 0) + (current ? 1 : -1) - (next ? 1 : -1)
        ),
      }))
      Alert.alert('Error', 'Failed to update like.')
      console.log(e)
    }
  }

  const onToggleReplies = async (postId: string, parentId: string) => {
    const isOpen = !!repliesOpenByParentId[parentId]
    const nextOpen = !isOpen

    setRepliesOpenByParentId((prev) => ({ ...prev, [parentId]: nextOpen }))
    if (!nextOpen) return

    // already loaded
    if (repliesByParentId[parentId]?.length) return

    setLoadingRepliesByParentId((prev) => ({ ...prev, [parentId]: true }))

    try {
      const res = await fetchCommentReplies(postId, parentId)
      console.log('replies', res.comments)

      if (!res.ok) {
        Alert.alert('Error', 'Failed to load replies.')
        return
      }

      const replies = res.comments ?? []

      setRepliesByParentId((prev) => ({
        ...prev,
        [parentId]: replies,
      }))

      setReplyCountById((prev) => ({
        ...prev,
        [parentId]: prev[parentId] ?? replies.length,
      }))
    } catch (e) {
      console.error(e)
      Alert.alert('Error', 'Failed to load replies.')
    } finally {
      setLoadingRepliesByParentId((prev) => ({
        ...prev,
        [parentId]: false,
      }))
    }
  }

  const openReplyComposer = (commentId: string) => {
    setReplyingToId(commentId)
    setReplyText('')
  }

  const cancelReplyComposer = () => {
    setReplyingToId(null)
    setReplyText('')
  }

  const submitReply = async (postId: string, parentId: string) => {
    const content = replyText.trim()
    if (!content) {
      Alert.alert('Empty reply', 'Please enter a reply.')
      return
    }

    try {
      const res = await createComment(postId, content, parentId)

      if (res?.ok === true && res.comment) {
        setRepliesByParentId((prev) => ({
          ...prev,
          [parentId]: [res.comment, ...(prev[parentId] ?? [])],
        }))
        setRepliesOpenByParentId((prev) => ({ ...prev, [parentId]: true }))

        // ✅ increment reply count for the parent
        setReplyCountById((prev) => ({
          ...prev,
          [parentId]: (prev[parentId] ?? 0) + 1,
        }))

        setReplyText('')
        setReplyingToId(null)
        return
      }

      Alert.alert('Error', 'Failed to create reply.')
    } catch (e) {
      console.error(e)
      Alert.alert('Error', 'Failed to create reply.')
    }
  }

  // animate open/close
  useEffect(() => {
    if (!parentHeight) return

    if (focusPost) {
      backdropOpacity.value = withTiming(1, { duration: 200 })
      translateY.value = withSpring(0, { damping: 200 })
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200 })
      translateY.value = withSpring(parentHeight + 50, { damping: 200 })
    }
  }, [focusPost, parentHeight])

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const postId = focusPost

  return (
    <View
      style={{ ...StyleSheet.absoluteFillObject }}
      onLayout={(e) => setParentHeight(e.nativeEvent.layout.height)}
    >
      {/* Backdrop */}
      <Animated.View
        pointerEvents={focusPost ? 'auto' : 'none'}
        style={[styles.backdrop, backdropStyle]}
      />

      {/* Panel */}
      <Animated.View
        pointerEvents={focusPost ? 'auto' : 'none'}
        style={[styles.panel, panelStyle]}
      >
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <Text style={styles.headerText}>Comments</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={22} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
          >
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : (
          <Animated.FlatList
            data={topLevelComments}
            keyExtractor={(c) => c.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isLiked = !!likedById[item.id]
              const likeCount = likeCountById[item.id] ?? 0
              const repliesCount = replyCountById[item.id] ?? 0
              const isRepliesOpen = !!repliesOpenByParentId[item.id]
              const repliesLoading = !!loadingRepliesByParentId[item.id]
              const replies = repliesByParentId[item.id] ?? []

              return (
                <Pressable
                  onLongPress={() => openCommentActions(item)}
                  delayLongPress={250}
                >
                  <View style={styles.comment}>
                    <View style={styles.commentHeader}>
                      <Pressable
                        onPress={() => {
                          router.push({
                            pathname: '/(app)/(user)/[id]',
                            params: {
                              id: item.user.id,
                              userInfo: JSON.stringify(item.user),
                            },
                          })
                        }}
                      >
                        <Text style={styles.name}>{item.user.displayName}</Text>
                      </Pressable>
                      <Text style={styles.time}>
                        {formatTimeAgo(item.createdAt)}
                      </Text>

                      <Text style={styles.replyCountPill}>
                        Replies · {repliesCount}
                      </Text>
                    </View>

                    <Text style={styles.commentText}>{item.content}</Text>

                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        onPress={() => onPressLike(item.id)}
                        style={styles.actionBtn}
                      >
                        <Heart
                          size={16}
                          color={isLiked ? '#EF4444' : '#111827'}
                        />
                        <Text style={styles.actionText}>{likeCount}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => openReplyComposer(item.id)}
                        style={styles.actionBtn}
                      >
                        <MessageCircle size={16} color="#111827" />
                        <Text style={styles.actionText}>Reply</Text>
                      </TouchableOpacity>

                      {postId && repliesCount > 0 && (
                        <TouchableOpacity
                          onPress={() => onToggleReplies(postId, item.id)}
                          style={styles.viewRepliesBtn}
                        >
                          <Text style={styles.viewRepliesText}>
                            {isRepliesOpen ? 'Hide' : 'View'} {repliesCount}{' '}
                            repl
                            {repliesCount === 1 ? 'y' : 'ies'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {postId && replyingToId === item.id && (
                      <View style={styles.replyComposerWrap}>
                        <View style={styles.threadRail} />
                        <View style={styles.replyComposer}>
                          <TextInput
                            value={replyText}
                            onChangeText={setReplyText}
                            placeholder="Write a reply…"
                            style={styles.replyInput}
                          />
                          <View style={styles.replyComposerActions}>
                            <TouchableOpacity
                              onPress={cancelReplyComposer}
                              style={styles.replyCancelBtn}
                            >
                              <Text style={styles.replyCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => submitReply(postId, item.id)}
                              style={styles.replyPostBtn}
                            >
                              <Text style={styles.replyPostText}>Post</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    )}

                    {postId && isRepliesOpen && (
                      <View style={styles.repliesWrap}>
                        <View style={styles.threadRail} />

                        <View style={styles.repliesList}>
                          {repliesLoading ? (
                            <View style={{ paddingVertical: 8 }}>
                              <Text style={styles.repliesHint}>
                                Loading replies…
                              </Text>
                            </View>
                          ) : replies.length === 0 ? (
                            <View style={{ paddingVertical: 8 }}>
                              <Text style={styles.repliesHint}>
                                No replies yet.
                              </Text>
                            </View>
                          ) : (
                            replies.map((r) => (
                              <Pressable
                                key={r.id}
                                onLongPress={() => openCommentActions(r)}
                                delayLongPress={250}
                              >
                                <View style={styles.replyItem}>
                                  <View style={styles.commentHeader}>
                                    <Text style={styles.name}>
                                      {r.user.displayName}
                                    </Text>
                                    <Text style={styles.time}>
                                      {formatTimeAgo(r.createdAt)}
                                    </Text>
                                  </View>

                                  <Text style={styles.commentText}>
                                    {r.content}
                                  </Text>

                                  <View style={styles.actionsRow}>
                                    <TouchableOpacity
                                      onPress={() => onPressLike(r.id)}
                                      style={styles.actionBtn}
                                    >
                                      <Heart
                                        size={16}
                                        color={
                                          likedById[r.id]
                                            ? '#EF4444'
                                            : '#111827'
                                        }
                                      />
                                      <Text style={styles.actionText}>
                                        {likeCountById[r.id] ?? 0}
                                      </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                      onPress={() => openReplyComposer(r.id)}
                                      style={styles.actionBtn}
                                    >
                                      <MessageCircle
                                        size={16}
                                        color="#111827"
                                      />
                                      <Text style={styles.actionText}>
                                        Reply
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              </Pressable>
                            ))
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                </Pressable>
              )
            }}
          />
        )}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment"
            onChangeText={setInputText}
            value={inputText}
          />
          <TouchableOpacity onPress={submitComment}>
            <Text style={{ color: '#007AFF', fontWeight: '600' }}>Post</Text>
          </TouchableOpacity>
        </View>
        <Modal
          visible={commentActionVisible}
          transparent
          animationType="fade"
          onRequestClose={closeCommentActions}
        >
          <Pressable style={styles.modalOverlay} onPress={closeCommentActions}>
            <Pressable style={styles.actionModal} onPress={() => {}}>
              <Text style={styles.actionModalTitle}>Comment options</Text>

              <TouchableOpacity
                style={styles.deleteActionBtn}
                onPress={handleDeleteComment}
              >
                <Text style={styles.deleteActionText}>Delete comment</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelActionBtn}
                onPress={closeCommentActions}
              >
                <Text style={styles.cancelActionText}>Cancel</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: '90%',
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 80,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ccc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#e5e5e5',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerText: { fontWeight: '600', fontSize: 16 },

  listContent: { padding: 16, paddingBottom: 80 },

  comment: { marginBottom: 16 },

  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  name: { fontWeight: '600', fontSize: 14 },
  time: { fontSize: 12, color: '#9CA3AF' },

  // ✅ replies count pill
  replyCountPill: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
    marginLeft: 6,
  },

  commentText: { marginTop: 4, fontSize: 14, color: '#111827' },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  actionText: { fontSize: 12, color: '#111827', fontWeight: '600' },

  viewRepliesBtn: { marginLeft: 'auto', paddingVertical: 4 },
  viewRepliesText: { fontSize: 12, color: '#6B7280', fontWeight: '600' },

  repliesWrap: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  replyComposerWrap: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  threadRail: {
    width: 2,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginLeft: 8,
  },
  repliesList: {
    flex: 1,
    paddingLeft: 2,
  },
  repliesHint: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  replyItem: {
    marginBottom: 12,
  },

  replyComposer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF',
  },
  replyInput: {
    fontSize: 14,
    paddingVertical: 6,
  },
  replyComposerActions: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  replyCancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  replyCancelText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
  },
  replyPostBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  replyPostText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '700',
  },

  inputBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#e5e5e5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  input: { flex: 1, fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  actionModal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  actionModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  deleteActionBtn: {
    paddingVertical: 14,
  },
  deleteActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626',
  },
  cancelActionBtn: {
    paddingVertical: 14,
    marginTop: 4,
  },
  cancelActionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
})
