/* Profile photos come only from Google's photo host (the database enforces the same rule) */
const GOOGLE_PHOTO = /^https:\/\/[a-z0-9-]+\.googleusercontent\.com\//;

export function safeAvatarUrl(url){
  return typeof url === 'string' && url.length <= 2048 && GOOGLE_PHOTO.test(url) ? url : null;
}

/* The photo on the signed-in account, if it has one */
export function accountPhoto(user){
  const meta = user?.user_metadata || {};
  return safeAvatarUrl(meta.avatar_url) || safeAvatarUrl(meta.picture);
}
