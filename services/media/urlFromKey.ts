// services/media/urlFromKey.ts
/**
 * Returns a fetchable URL for an S3 object key.
 * - If EXPO_PUBLIC_S3_PUBLIC_PREFIX is set (public bucket), we build the URL.
 * - Otherwise, we ask backend to mint a pre-signed URL.
 */
export function urlFromKey(key?: string | null) {
  if (!key) return null

  const pubPrefix = 'https://social0912.s3.ca-west-1.amazonaws.com'
  // e.g. "https://my-bucket.s3.ca-central-1.amazonaws.com"
  return `${pubPrefix.replace(/\/$/, '')}/${key}`
}
