import { MediaTypes } from './schemas'
export type AssetLike = { type?: string; mimeType?: string; uri?: string }

export function toAllowedMime(a: AssetLike): MediaTypes | null {
  const mt = (a.mimeType || '').toLowerCase()
  if (['image/jpeg', 'image/png', 'image/webp', 'video/mp4'].includes(mt))
    return mt as MediaTypes
  if (a.type === 'image') return 'image/jpeg'
  if (a.type === 'video') return 'video/mp4'
  const ext = (a.uri || '').toLowerCase()
  if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) return 'image/jpeg'
  if (ext.endsWith('.png')) return 'image/png'
  if (ext.endsWith('.webp')) return 'image/webp'
  if (ext.endsWith('.mp4')) return 'video/mp4'
  return null
}

export function normalizeAssetMimes(assets: AssetLike[]): MediaTypes[] {
  return assets
    .map(toAllowedMime)
    .filter((x): x is MediaTypes => !!x)
    .slice(0, 10)
}
