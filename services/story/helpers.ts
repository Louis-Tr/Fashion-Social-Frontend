import type { ImagePickerAsset } from 'expo-image-picker'
import { ImageManipulator } from 'expo-image-manipulator'
import { Video } from 'react-native-compressor'

export type RNFile = {
  uri: string
  name: string
  type: string
  size?: number
}

export async function prepareFileForUpload(
  asset: ImagePickerAsset
): Promise<RNFile> {
  if (asset.type === 'image') {
    return await prepareImage(asset)
  }

  if (asset.type === 'video') {
    return await prepareVideo(asset)
  }

  throw new Error('Unsupported asset type')
}

const STANDARD_IMAGE_SIZE = 1080
const STANDARD_IMAGE_QUALITY = 0.8

export async function prepareImage(asset: ImagePickerAsset): Promise<RNFile> {
  const width = asset.width ?? STANDARD_IMAGE_SIZE
  const height = asset.height ?? STANDARD_IMAGE_SIZE
  const squareSize = Math.max(1, Math.min(width, height))

  // Enforce a single image output format for predictable upload size and quality.
  const rendered = await ImageManipulator.manipulate(asset.uri)
    .crop({
      originX: Math.max(0, Math.floor((width - squareSize) / 2)),
      originY: Math.max(0, Math.floor((height - squareSize) / 2)),
      width: squareSize,
      height: squareSize,
    })
    .resize({ width: STANDARD_IMAGE_SIZE, height: STANDARD_IMAGE_SIZE })
    .renderAsync()

  const saved = await rendered.saveAsync({
    format: "jpeg",
    compress: STANDARD_IMAGE_QUALITY,
  })

  return {
    uri: saved.uri,
    name: `${asset.fileName ?? 'image'}.jpg`,
    type: 'image/jpeg',
    size: asset.fileSize,
  }
}

async function prepareVideo(asset: ImagePickerAsset): Promise<RNFile> {
  const ext = asset.fileName?.split('.').pop()?.toLowerCase()

  let uri = asset.uri

  const isMp4 = ext === 'mp4' || asset.mimeType === 'video/mp4'

  if (!isMp4) {
    // Convert MOV / others → MP4
    uri = await Video.compress(asset.uri, {
      compressionMethod: 'auto',
    })
  }

  return {
    uri,
    name: (asset.fileName ?? 'video') + '.mp4',
    type: 'video/mp4',
    size: asset.fileSize,
  }
}

export async function uploadToS3(
  presignedUrl: string,
  file: RNFile
): Promise<void> {
  // Turn file.uri (file://...) into a Blob
  const fileResp = await fetch(file.uri)
  const blob = await fileResp.blob()

  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: blob,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`S3 upload failed: ${response.status} ${text}`)
  }
}
