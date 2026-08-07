import path from 'node:path';

export const privateDataRoot = process.env.PRIVATE_DATA_ROOT?.trim() || '/private';
export const mediaAssetRoot = process.env.MEDIA_ASSET_ROOT?.trim() || '/shared-storage/public/assets';
export const mediaDirectory = path.join(mediaAssetRoot, 'media');
export const uploadDirectory = path.join(mediaAssetRoot, 'uploads');

export function uploadSubdirectory(name: string): string {
  return path.join(uploadDirectory, name);
}

export function privateSubdirectory(name: string): string {
  return path.join(privateDataRoot, name);
}
