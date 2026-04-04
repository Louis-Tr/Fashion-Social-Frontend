export type Comment = {
  id: string
  content: string
  createdAt: string
  reactions: number
  replies: number
  user: {
    id: string
    displayName: string
    avatarKey: string | null
  }
  children?: Comment[]
}
