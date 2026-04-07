// src/services/friendship.ts
import { API_BASE_URL } from '@/constants/Url'
import { getToken } from '@/utils/token'

type FriendshipStatus = 'pending' | 'accepted'

export type FriendshipEdgeResponse = {
  userId: string
  friendId: string
  status: FriendshipStatus
  createdAt: string
  updatedAt: string
}

export type BlockAction = 'blocked' | 'declined_and_blocked' | 'unblocked'

export type BlockActionResponse = {
  userId: string
  friendId: string
  action: BlockAction
}

async function authPost(path: string, body?: unknown) {
  const token = getToken()
  if (!token) {
    throw new Error('No access token available')
  }

  const res = await fetch(`${API_BASE_URL}/user${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : JSON.stringify({}),
  })

  let data: any = null
  try {
    data = await res.json()
  } catch {
    // ignore JSON parse error; will fall back to generic error
  }

  if (!res.ok) {
    const message = data?.message || `Request failed with status ${res.status}`
    throw new Error(message)
  }

  return data
}

export async function addFriendRequest(
  targetId: string
): Promise<FriendshipEdgeResponse> {
  return authPost(`/friend/${targetId}/request`)
}

export async function acceptFriendRequest(
  targetId: string
): Promise<FriendshipEdgeResponse> {
  return authPost(`/friend/${targetId}/accept`)
}

export async function blockRequest(
  targetId: string
): Promise<BlockActionResponse> {
  return authPost(`/friend/${targetId}/block`)
}

export async function unblockRequest(
  targetId: string
): Promise<BlockActionResponse> {
  return authPost(`/friend/${targetId}/unblock`)
}

export async function getFriendshipStatus(
  targetId: string
): Promise<
  | 'self'
  | 'blocked'
  | 'blocked_by_them'
  | 'friend'
  | 'incoming_request'
  | 'outgoing_request'
  | 'none'
> {
  const token = await getToken()
  if (!token) throw new Error('Missing access token')

  const res = await fetch(`${API_BASE_URL}/user/friend/${targetId}/status`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data?.message || 'Failed to fetch friendship status')
  }

  return data.status
}

export async function unfriendRequest(targetId: string) {
  const token = await getToken()
  if (!token) throw new Error('No access token available')

  const res = await fetch(`${API_BASE_URL}/friend/${targetId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  let data: any = null
  try {
    data = await res.json()
  } catch {
    // ignore parse errors
  }

  if (!res.ok) {
    throw new Error(
      data?.message || `Failed to unfriend (status ${res.status})`
    )
  }

  return data
}
