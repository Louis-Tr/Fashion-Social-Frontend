// src/services/wardrobe/api.ts
import { z } from 'zod'
import { ApiErrSchema, CreateWardrobeItemReq } from './schemas'
import { API_BASE_URL } from '@/constants/Url'
import { prepareFileForUpload, uploadToS3 } from '@/services/media'
import { ImagePickerAsset } from 'expo-image-picker'
import { getUser } from '@/utils/getUser'

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

export type WardrobeApiConfig = {
  /**
   * Defaults to `${BASE_URL}/wardrobe`.
   * If you want auto-default, pass nothing and ensure global BASE_URL exists,
   * or pass { baseUrl: `${BASE_URL}/wardrobe`, getToken } explicitly.
   */
  baseUrl?: string
  getToken: () => Promise<string | null> | string | null
  fetcher?: Fetcher
}

function defaultBaseUrl() {
  // Safe default: `${BASE_URL}/wardrobe`
  if (typeof API_BASE_URL === 'string' && API_BASE_URL.length > 0)
    return `${API_BASE_URL}/wardrobe`
  // Fallback: relative mount (useful in web)
  return '/wardrobe'
}

function asBoolQuery(v?: boolean) {
  if (v === undefined) return undefined
  return v ? 'true' : 'false'
}

async function readJson(res: Response) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { ok: false, message: 'Invalid JSON response' }
  }
}

function validateReq<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data)
  if (!r.success) {
    const msg = r.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new Error(`Invalid request: ${msg}`)
  }
  return r.data
}

function validateRes<T>(schema: z.ZodType<T>, data: unknown): T {
  const ok = (data as any)?.ok
  if (ok === false) {
    const err = ApiErrSchema.safeParse(data)
    if (err.success) throw new Error(err.data.message)
    throw new Error('Request failed')
  }
  const r = schema.safeParse(data)
  if (!r.success) {
    const msg = r.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new Error(`Invalid response: ${msg}`)
  }
  return r.data
}

type QueryValue = string | number | boolean | null | undefined

function makeUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, QueryValue>
) {
  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : baseUrl + '/')

  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue
      url.searchParams.set(k, String(v))
    }
  }

  return url.toString()
}

async function authedRequest(
  cfg: Required<Pick<WardrobeApiConfig, 'getToken'>> &
    Partial<Pick<WardrobeApiConfig, 'fetcher' | 'baseUrl'>>,
  method: string,
  path: string,
  body?: any,
  query?: Record<string, QueryValue>,
  opts?: { signal?: AbortSignal }
) {
  const fetcher = cfg.fetcher ?? fetch
  const token = await cfg.getToken()
  const baseUrl = cfg.baseUrl ?? defaultBaseUrl()

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetcher(makeUrl(baseUrl, path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: opts?.signal,
  })

  const json = await readJson(res)

  if (!res.ok && (json?.ok ?? true) !== false) {
    throw new Error(`HTTP ${res.status}`)
  }
  return json
}

export const CreateWardRobeItemInput = z.object({
  req: CreateWardrobeItemReq,
  mediaUrls: z.array(z.string()),
})

export type CreateWardrobeItemReq = z.infer<typeof CreateWardrobeItemReq>

export type CreateWardRobeItemInput = {
  req: CreateWardrobeItemReq
  medias: ImagePickerAsset[]
}

/**
 * Public factory name per your request.
 * Defaults cfg.baseUrl to `${BASE_URL}/wardrobe`.
 */
type returnItem = {
  id: string
  name: string
  brand: string | null
  color: string | null
  size: string | null
  material: string | null
  season: string | null
  notes: string | null
  visibility: boolean
  presignedUrls: string[]
  createdAt: string
  updatedAt: string
}
export function WardrobeAPI(cfg: WardrobeApiConfig) {
  const baseUrl = cfg.baseUrl ?? defaultBaseUrl()

  return {
    /** -------------------------
     * Items
     * ------------------------- */

    async createItem(input: CreateWardRobeItemInput) {
      const body = validateReq(CreateWardrobeItemReq, input.req)
      const json = await authedRequest(
        { ...cfg, baseUrl },
        'POST',
        'items',
        body
      )
      const data = json.item as returnItem
      console.log(data)

      for (const [index, image] of input.medias.entries()) {
        const prep = await prepareFileForUpload(image)
        try {
          await uploadToS3(data.presignedUrls[index], prep)
        } catch (err) {
          console.error('Failed to upload photo', err)
        }
      }
      return data
    },

    /**
     * Search Query
     */

    async searchItem(
      query: string,
      limit: number = 5,
      includePhotos: boolean = false,
      signal?: AbortSignal
    ) {
      const user = getUser()
      if (!user?.sub) throw new Error('Missing user id')

      const json = await authedRequest(
        { ...cfg, baseUrl },
        'GET',
        'items/search/' + user.sub,
        undefined,
        {
          query,
          limit,
          includePhotos,
        },
        { signal } // ✅ pass signal here
      )

      return json.items
    },
  }
}
