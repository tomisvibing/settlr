/* Receipt files in Supabase Storage (private "receipts" bucket, see the receipts migration) */
import { sb } from './supabase.js';
import { reportError } from './monitoring.js';
import { MAX_RECEIPT_BYTES, acceptedType, isPdf, fitWithin, receiptPath, sizeLabel } from './lib/receipt.js';

const BUCKET = 'receipts';

/* Phone photos are 3–10 MB; shrink them to a JPEG that's still easy to read.
   PDFs, and images the browser can't decode (HEIC outside Safari), go up as they are. */
export async function prepareReceipt(file){
  if(!acceptedType(file.type)) throw new Error('Choose a photo or a PDF.');
  if(!isPdf(file.type)){
    try{
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const { w, h } = fitWithin(bmp.width, bmp.height);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
      bmp.close?.();
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.8));
      if(blob && blob.size < file.size) return blob;
    }catch{ /* fall through to the original file */ }
  }
  if(file.size > MAX_RECEIPT_BYTES) throw new Error(`That file is ${sizeLabel(file.size)}. Receipts can be up to 10 MB.`);
  return file;
}

export async function uploadReceipt(groupId, blob){
  const path = receiptPath(groupId, crypto.randomUUID(), blob.type);
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
  if(error) throw error;
  return path;
}

/* Best effort: a leftover file is invisible to people and costs almost nothing */
export async function removeReceipts(paths){
  const list = paths.filter(Boolean);
  if(!list.length) return;
  const { error } = await sb.storage.from(BUCKET).remove(list);
  if(error) reportError(error, 'remove receipts');
}

/* Signed links last an hour; keep them for 50 minutes so re-renders don't re-ask */
const urls = new Map();
export async function receiptUrl(path){
  const hit = urls.get(path);
  if(hit && hit.until > Date.now()) return hit.url;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
  if(error) throw error;
  urls.set(path, { url: data.signedUrl, until: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

/* Every receipt in a group's folder, for cleaning up when the group is deleted */
export async function groupReceiptPaths(groupId){
  const { data, error } = await sb.storage.from(BUCKET).list(groupId, { limit: 1000 });
  if(error){ reportError(error, 'list receipts'); return []; }
  return (data || []).map(f => `${groupId}/${f.name}`);
}
