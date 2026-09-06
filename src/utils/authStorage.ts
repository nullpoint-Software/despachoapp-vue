const AUTH_STORAGE_KEYS = [
  'token',
  'fullname',
  'username',
  'userid',
  'level',
  'userphoto',
  'showToast'
] as const

export function clearAuthSession(): void {
  for (const key of AUTH_STORAGE_KEYS) {
    localStorage.removeItem(key)
  }
}
