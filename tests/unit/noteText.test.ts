import { describe, expect, it } from 'vitest'
import { countNoteText, extractNoteText, previewNoteText } from '../../src/modules/notes/noteText'

const document = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Pendiente del mes' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Enviar', marks: [{ type: 'bold' }] }, { type: 'text', text: ' la declaración' }] },
    { type: 'image', attrs: { src: 'data:image/png;base64,AAAA' } },
    { type: 'paragraph' }
  ]
}

describe('note text for the directory', () => {
  it('joins text nodes, separates blocks and ignores nodes without text', () => {
    expect(extractNoteText(document)).toBe('Pendiente del mes Enviar la declaración')
    expect(extractNoteText({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('')
  })

  it('cuts long previews with an ellipsis and counts words and characters', () => {
    expect(previewNoteText(document, 20)).toBe('Pendiente del mes E…')
    expect(previewNoteText(document)).toBe('Pendiente del mes Enviar la declaración')
    expect(countNoteText(document)).toEqual({ wordCount: 6, characterCount: 39 })
    expect(countNoteText({ type: 'doc' })).toEqual({ wordCount: 0, characterCount: 0 })
  })
})
