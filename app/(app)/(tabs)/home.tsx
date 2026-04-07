import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '@/store/store'
import Post from '@/components/Post'
import CommentPanel from '@/components/CommentPanel'
import { fetchFeed } from '@/services/feed'
import { fetchComment } from '@/services/posts/fetchComment'
import { Comment } from '@/types/comment'
import StoryBar from '@/components/StoryBar'
import { fetchStories } from '@/services/story/fetchStories'
import { hideTabBar, showTabBar } from '@/store/slices/tabBarSlice'

export default function HomeScreen() {
  const dispatch = useDispatch<AppDispatch>()
  const { posts } = useSelector((state: RootState) => state.post)
  const { stories } = useSelector((state: RootState) => state.story)

  const [focusPost, setFocusPost] = useState<string | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoadingComments, setIsLoadingComments] = useState(false)

  // Fetch initial feed
  useEffect(() => {
    dispatch(fetchFeed())
    dispatch(fetchStories())
  }, [dispatch])

  // Hide tab bar when a post is open
  useEffect(() => {
    if (focusPost) {
      dispatch(hideTabBar())
    } else {
      dispatch(showTabBar())
    }

    return () => {
      dispatch(showTabBar())
    }
  }, [focusPost, dispatch])

  // Centralized open comment logic
  const openComment = async (postId: string) => {
    setIsLoadingComments(true)
    setFocusPost(postId)
    setComments([])

    try {
      const { comments } = await fetchComment(postId)
      setComments(comments)
    } catch (err) {
      console.error('Failed to fetch comments:', err)
    } finally {
      setIsLoadingComments(false)
    }
  }

  const handleLoadMore = () => {
    dispatch(fetchFeed())
  }

  const onClose = () => {
    setFocusPost(null)
    setComments([])
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Post {...item} setFocusPost={() => openComment(item.id)} />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Welcome to Fashion Social</Text>
            <StoryBar stories={stories} />
          </View>
        }
        onEndReachedThreshold={0.3}
        onEndReached={handleLoadMore}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No posts available right now, let&apos;s create some of your own.
          </Text>
        }
        windowSize={7}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={false}
      />

      <CommentPanel
        focusPost={focusPost}
        onClose={onClose}
        comments={comments}
        isLoading={isLoadingComments}
        onAddComment={(comment: Comment) =>
          setComments((prev) => [comment, ...prev])
        }
        onDeleteComment={(commentId: string) =>
          setComments((prev) =>
            prev.filter((comment) => comment.id !== commentId)
          )
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  // Tailwind: text-2xl font-semibold tracking-wide text-pink-600
  title: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#DB2777', // pink-600-ish
  },
  // Tailwind: text-gray-500 mt-10 text-center
  emptyText: {
    marginTop: 40,
    textAlign: 'center',
    color: '#6B7280', // gray-500-ish
  },
})
