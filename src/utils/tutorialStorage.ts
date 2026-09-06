const TUTORIAL_STORAGE_PREFIX = 'despachoapp:tutorial:v1'
const COMPLETED_VALUE = 'true'

function currentUserScope(): string {
  const identifier = localStorage.getItem('userid') || localStorage.getItem('username')
  return encodeURIComponent(identifier?.trim() || 'anonymous')
}

function scopedTutorialKey(tutorialId: string): string {
  return `${TUTORIAL_STORAGE_PREFIX}:${currentUserScope()}:${tutorialId}`
}

export function hasCompletedTutorial(tutorialId: string): boolean {
  const scopedKey = scopedTutorialKey(tutorialId)
  if (localStorage.getItem(scopedKey) === COMPLETED_VALUE) return true

  if (localStorage.getItem(tutorialId) === COMPLETED_VALUE) {
    localStorage.setItem(scopedKey, COMPLETED_VALUE)
    localStorage.removeItem(tutorialId)
    return true
  }

  return false
}

export function completeTutorial(tutorialId: string): void {
  localStorage.setItem(scopedTutorialKey(tutorialId), COMPLETED_VALUE)
  localStorage.removeItem(tutorialId)
}
