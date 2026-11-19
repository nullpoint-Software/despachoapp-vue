import { describe, expect, it } from 'vitest'
import { areAllSelected, toggleAllSelection } from '../../src/modules/fiscal/fiscalSelection'

/** "Seleccionar todas" de Fiscal: sólo la vista filtrada; lo seleccionado fuera de ella se conserva. */
describe('fiscal select all', () => {
  const visibleUuids = ['a', 'b', 'c']

  it('selects every visible uuid without duplicating or dropping outside selections', () => {
    expect(toggleAllSelection(['b', 'outside'], visibleUuids).sort()).toEqual(['a', 'b', 'c', 'outside'])
  })

  it('clears only the visible uuids when all of them are already selected', () => {
    expect(areAllSelected(['a', 'b', 'c', 'outside'], visibleUuids)).toBe(true)
    expect(toggleAllSelection(['a', 'b', 'c', 'outside'], visibleUuids)).toEqual(['outside'])
  })

  it('never reports an empty view as fully selected', () => {
    expect(areAllSelected(['a'], [])).toBe(false)
    expect(toggleAllSelection(['a'], [])).toEqual(['a'])
  })
})
