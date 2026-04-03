// src/services/places/fetchPlaces.ts
import { z } from 'zod'
import { BASE_URL } from '@/constants/Url'

export const PlaceSchema = z.object({
  placeId: z.string(),
  text: z.string(),
  mainText: z.string(),
  secondaryText: z.string(),
  types: z.array(z.string()),
})

export const FetchPlacesResSchema = z.object({
  places: z.array(PlaceSchema),
})

export type Place = z.infer<typeof PlaceSchema>
export type FetchPlacesRes = z.infer<typeof FetchPlacesResSchema>

export async function fetchPlaces(input: string): Promise<Place[]> {
  const trimmed = input.trim()

  if (!trimmed) return []

  const query = new URLSearchParams({
    input: trimmed,
  })

  const res = await fetch(`${BASE_URL}/places?${query.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || 'Failed to fetch places')
  }

  const json = await res.json()
  const parsed = FetchPlacesResSchema.parse(json)
  console.log('Parsed places:', parsed.places)

  return parsed.places
}
