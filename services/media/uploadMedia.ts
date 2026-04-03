import type { ImagePickerAsset } from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { Video } from 'react-native-compressor'
import * as FileSystem from 'expo-file-system'

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

export async function prepareImage(asset: ImagePickerAsset): Promise<RNFile> {
  const ext = asset.fileName?.split('.').pop()?.toLowerCase()

  const needsConvert =
    ext !== 'jpg' && ext !== 'jpeg' && asset.mimeType !== 'image/jpeg'

  let uri = asset.uri

  if (needsConvert) {
    // Create manipulator context
    const ctx = ImageManipulator.manipulate(asset.uri)

    // Apply (optional) resize + render
    const rendered = await ctx
      .resize({ width: 1080 }) // keep aspect ratio
      .renderAsync()

    // Save as compressed JPEG
    const saved = await rendered.saveAsync({
      format: ImageManipulator.SaveFormat.JPEG,
      compress: 0.8,
    })

    uri = saved.uri
  }

  return {
    uri,
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
  fileOrUri: RNFile | string
): Promise<void> {
  const uri = typeof fileOrUri === 'string' ? fileOrUri : fileOrUri.uri
  const contentType =
    typeof fileOrUri === 'string' ? 'application/octet-stream' : fileOrUri.type

  const fileResp = await fetch(uri)
  const blob = await fileResp.blob()

  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: blob,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`S3 upload failed: ${response.status} ${text}`)
  }
}
