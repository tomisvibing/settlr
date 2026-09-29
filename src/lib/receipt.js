/* Pure helpers for receipts (tested in test/receipt.test.js) */

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
/* Long edge of a shrunk photo: enough to read a till receipt, around 200–400 KB as JPEG */
export const MAX_EDGE = 1600;

const EXT = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'image/heic':'heic', 'image/heif':'heif', 'application/pdf':'pdf' };
export const isPdf = type => type === 'application/pdf';
export const acceptedType = type => type in EXT;

/* Storage path "<group id>/<file id>.<ext>": the group folder is what the storage policies check */
export function receiptPath(groupId, fileId, type){
  return `${groupId}/${fileId}.${EXT[type] || 'bin'}`;
}
export const pathIsPdf = path => /\.pdf$/i.test(path || '');

/* Scale (w, h) down so the long edge is at most max; never scales up */
export function fitWithin(w, h, max = MAX_EDGE){
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

export function sizeLabel(bytes){
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
