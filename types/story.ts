import Reaction from './reaction'

type StoryProps = {
  id: string
  userId: string
  username: string
  contentUri: string
  createdAt: string
  isRead: boolean
  reactions: Reaction[]
}

export default StoryProps
