import { describe, expect, it } from 'vitest'
import { moveWithTab } from '../../src/shared/components/popoverMenu'

const tab = (shiftKey = false) => { let isPrevented = false; return { event: { shiftKey, preventDefault: () => { isPrevented = true } } as KeyboardEvent, wasPrevented: () => isPrevented } }

describe('moveWithTab', () => {
  it('walks the suggestions after typing and lets Tab leave at either end', () => {
    const forward = tab()
    expect(moveWithTab(forward.event, -1, 3, true)).toBe(0)
    expect(forward.wasPrevented()).toBe(true)
    expect(moveWithTab(tab().event, 1, 3, true)).toBe(2)
    expect(moveWithTab(tab(true).event, 2, 3, true)).toBe(1)
    const atEnd = tab()
    expect(moveWithTab(atEnd.event, 2, 3, true)).toBeNull()
    expect(atEnd.wasPrevented()).toBe(false)
    expect(moveWithTab(tab(true).event, 0, 3, true)).toBeNull()
  })
  it('never traps focus when the field was only passed through or has no suggestions', () => {
    expect(moveWithTab(tab().event, -1, 3, false)).toBeNull()
    expect(moveWithTab(tab().event, -1, 0, true)).toBeNull()
  })
})
