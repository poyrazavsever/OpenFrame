'use client';

export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Please select an image file';
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return 'Image must be less than 10MB';
  }

  return null;
}

export function extractPastedImageFile(data: DataTransfer | null | undefined): File | null {
  const items = data?.items;
  if (!items) return null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) return file;
  }

  return null;
}
