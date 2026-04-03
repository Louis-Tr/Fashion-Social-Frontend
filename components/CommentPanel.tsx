export default function CommentBottomSheet({
  visible,
  onClose,
  comments,
  addComment,
}) {
  const [draft, setDraft] = React.useState('')
  const translateY = useSharedValue(height)
  const snapPoints = [height * 0.85, height * 0.5] // expanded, collapsed

  useEffect(() => {
    translateY.value = visible ? withSpring(snapPoints[0]) : withSpring(height)
  }, [visible])

  const gesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0)
        translateY.value = snapPoints[0] + e.translationY
    })
    .onEnd((e) => {
      if (e.translationY > 100) {
        runOnJS(onClose)()
      } else {
        translateY.value = withSpring(snapPoints[0])
      }
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value - height }],
  }))

  const handleSend = () => {
    if (!draft.trim()) return
    addComment(draft)
    setDraft('')
  }

  return (
    <>
      {/* Dim background */}
      {visible && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}
        />
      )}

      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: snapPoints[0],
              backgroundColor: 'white',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              overflow: 'hidden',
            },
            animatedStyle,
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
            style={{ flex: 1 }}
          >
            {/* Handle */}
            <View
              style={{
                alignItems: 'center',
                paddingVertical: 6,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#ccc',
                }}
              />
            </View>

            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderColor: '#eee',
              }}
            >
              <Text style={{ fontWeight: '600', fontSize: 16 }}>Comments</Text>
              <TouchableOpacity onPress={onClose}>
                <X size={22} />
              </TouchableOpacity>
            </View>

            {/* Comments list */}
            <FlatList
              data={comments}
              keyExtractor={(c) => c.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <View style={{ marginBottom: 10 }}>
                  <Text style={{ fontWeight: '600' }}>{item.user}</Text>
                  <Text>{item.text}</Text>
                </View>
              )}
            />

            {/* Composer */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderTopWidth: 1,
                borderColor: '#eee',
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Add a comment..."
                style={{
                  flex: 1,
                  backgroundColor: '#f2f2f2',
                  borderRadius: 20,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}
                returnKeyType="send"
                onSubmitEditing={handleSend}
              />
              <TouchableOpacity onPress={handleSend} disabled={!draft.trim()}>
                <Text
                  style={{
                    color: draft.trim() ? '#007aff' : '#aaa',
                    fontWeight: '600',
                    marginLeft: 10,
                  }}
                >
                  Post
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </GestureDetector>
    </>
  )
}