import { renderMarkdown } from './markdown'

const EMPTY_DOCUMENT = '<p><br></p>'

function escapeMarkdownText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/([`*_[\]<>])/g, '\\$1')
}

function escapeLabel(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/([\[\]])/g, '\\$1')
}

function escapeUrl(value: string) {
  return value.trim().replace(/\s/g, '%20').replace(/\)/g, '%29')
}

function directChildren(element: Element, selector: string) {
  return Array.from(element.children).filter((child) => child.matches(selector))
}

function annotationLatex(element: Element) {
  return (
    element.getAttribute('data-latex') ||
    element.querySelector('annotation[encoding="application/x-tex"]')?.textContent ||
    ''
  )
}

export function markdownToVisualHtml(source = '') {
  if (typeof document === 'undefined') return renderMarkdown(source)
  const template = document.createElement('template')
  template.innerHTML = renderMarkdown(source)

  template.content.querySelectorAll('img').forEach((image) => {
    if (image.closest('figure.document-image')) return
    const figure = document.createElement('figure')
    figure.className = 'document-image'
    const caption = document.createElement('figcaption')
    caption.textContent = image.getAttribute('alt') || 'Descripción de la imagen'
    caption.setAttribute('data-placeholder', 'Descripción de la imagen')
    image.setAttribute('contenteditable', 'false')
    const parent = image.parentElement
    const isOnlyChild =
      parent?.tagName === 'P' &&
      Array.from(parent.childNodes).every((node) => node === image || !node.textContent?.trim())
    if (isOnlyChild && parent) parent.replaceWith(figure)
    else image.replaceWith(figure)
    figure.append(image, caption)
  })

  template.content.querySelectorAll('u').forEach((element) => {
    element.classList.add('pinned-highlight')
  })

  template.content.querySelectorAll('.katex-display,.katex').forEach((element) => {
    const latex = annotationLatex(element)
    if (latex) element.setAttribute('data-latex', latex)
    element.setAttribute('contenteditable', 'false')
  })

  template.content.querySelectorAll("li input[type='checkbox']").forEach((input) => {
    input.closest('ul')?.classList.add('task-list')
    input.removeAttribute('disabled')
  })

  return template.innerHTML.trim() || EMPTY_DOCUMENT
}

function serializeInline(node: Node): string {
  if (node.nodeType === 3) return escapeMarkdownText(node.textContent || '')
  if (node.nodeType !== 1) return ''
  const element = node as HTMLElement
  const tag = element.tagName
  const content = () => Array.from(element.childNodes).map(serializeInline).join('')

  if (tag === 'BR') return '\n'
  if (tag === 'STRONG' || tag === 'B') return `**${content()}**`
  if (tag === 'EM' || tag === 'I') return `*${content()}*`
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') return `~~${content()}~~`
  if (
    tag === 'U' ||
    element.style.textDecoration.includes('underline') ||
    element.style.textDecorationLine.includes('underline')
  )
    return `<u>${content()}</u>`
  if (tag === 'CODE') return `\`${(element.textContent || '').replace(/`/g, '\\`')}\``
  if (tag === 'A') return `[${content()}](${escapeUrl(element.getAttribute('href') || '')})`
  if (tag === 'IMG') {
    const alt = escapeLabel(element.getAttribute('alt') || 'Descripción de la imagen')
    return `![${alt}](${escapeUrl(element.getAttribute('src') || '')})`
  }
  if (element.hasAttribute('data-latex') || element.classList.contains('katex')) {
    const latex = annotationLatex(element)
    return latex ? `$${latex}$` : content()
  }
  if (tag === 'SUP' || tag === 'SUB' || tag === 'MARK')
    return `<${tag.toLowerCase()}>${content()}</${tag.toLowerCase()}>`
  return content()
}

function serializeList(list: HTMLElement, depth = 0): string {
  const ordered = list.tagName === 'OL'
  const start = Number(list.getAttribute('start')) || 1
  const items = directChildren(list, 'li') as HTMLElement[]
  return (
    items
      .map((item, index) => {
        const nested = directChildren(item, 'ul,ol') as HTMLElement[]
        const checkbox = Array.from(item.children).find((child) =>
          child.matches("input[type='checkbox']")
        ) as HTMLInputElement | undefined
        const body = Array.from(item.childNodes)
          .filter(
            (child) =>
              !(child.nodeType === 1 && (child as Element).matches("ul,ol,input[type='checkbox']"))
          )
          .map(serializeInline)
          .join('')
          .trim()
        const prefix = checkbox
          ? `- [${checkbox.checked ? 'x' : ' '}]`
          : ordered
            ? `${start + index}.`
            : '-'
        const nestedText = nested
          .map((child) =>
            serializeList(child, depth + 1)
              .trimEnd()
              .split('\n')
              .map((line) => `  ${line}`)
              .join('\n')
          )
          .filter(Boolean)
          .join('\n')
        return `${prefix} ${body}${nestedText ? `\n${nestedText}` : ''}`
      })
      .join('\n') + '\n\n'
  )
}

function serializeTable(table: HTMLElement) {
  const rows = Array.from(table.querySelectorAll('tr'))
  if (!rows.length) return ''
  const values = rows.map((row) =>
    Array.from(row.querySelectorAll('th,td')).map((cell) =>
      serializeInline(cell).replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim()
    )
  )
  const columns = Math.max(...values.map((row) => row.length), 1)
  const normalized = values.map((row) =>
    Array.from({ length: columns }, (_, index) => row[index] || '')
  )
  const header = normalized[0]
  return (
    [
      `| ${header.join(' | ')} |`,
      `| ${header.map(() => '---').join(' | ')} |`,
      ...normalized.slice(1).map((row) => `| ${row.join(' | ')} |`)
    ].join('\n') + '\n\n'
  )
}

function serializeBlock(node: Node): string {
  if (node.nodeType === 3)
    return node.textContent?.trim() ? `${escapeMarkdownText(node.textContent)}\n\n` : ''
  if (node.nodeType !== 1) return ''
  const element = node as HTMLElement
  const tag = element.tagName
  const inline = () => Array.from(element.childNodes).map(serializeInline).join('').trim()
  const blocks = () => Array.from(element.childNodes).map(serializeBlock).join('')

  if (/^H[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag[1]))} ${inline()}\n\n`
  if (tag === 'P') return `${inline()}\n\n`
  if (tag === 'UL' || tag === 'OL') return serializeList(element)
  if (tag === 'BLOCKQUOTE') {
    const quote = Array.from(element.childNodes)
      .map((child) => (child.nodeType === 1 ? serializeBlock(child) : serializeInline(child)))
      .join('')
      .trim()
    return (
      quote
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n') + '\n\n'
    )
  }
  if (tag === 'PRE') return `\`\`\`\n${element.textContent?.replace(/\n$/, '') || ''}\n\`\`\`\n\n`
  if (tag === 'HR') return '---\n\n'
  if (tag === 'TABLE') return serializeTable(element)
  if (tag === 'FIGURE') {
    const image = element.querySelector('img')
    if (!image) return blocks()
    const caption =
      element.querySelector('figcaption')?.textContent?.trim() ||
      image.getAttribute('alt') ||
      'Descripción de la imagen'
    return `![${escapeLabel(caption)}](${escapeUrl(image.getAttribute('src') || '')})\n\n`
  }
  if (element.classList.contains('katex-display')) {
    const latex = annotationLatex(element)
    return latex ? `$$\n${latex}\n$$\n\n` : ''
  }
  if (element.hasAttribute('data-latex') || element.classList.contains('katex')) {
    const latex = annotationLatex(element)
    return latex ? `$${latex}$\n\n` : ''
  }
  if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE') {
    const hasBlockChildren = Array.from(element.children).some((child) =>
      /^(P|DIV|H[1-6]|UL|OL|BLOCKQUOTE|PRE|TABLE|FIGURE|HR)$/.test(child.tagName)
    )
    return hasBlockChildren ? blocks() : `${inline()}\n\n`
  }
  return `${serializeInline(element)}\n\n`
}

export function visualHtmlToMarkdown(root: HTMLElement) {
  return Array.from(root.childNodes)
    .map(serializeBlock)
    .join('')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
