import { readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { NodeTypes, ElementTypes, parse, transform, type ElementNode } from '@vue/compiler-dom'
import { normalizePath, type ModuleNode, type Plugin } from 'vite'

const EXTERNAL_SETUP_BLOCK = /<script([^>]*?)\ssource=["']([^"']+)["']([^>]*)><\/script>/g
const INSPECTOR_ATTRIBUTE = 'data-v-inspector'
const INSPECTOR_EXCLUDED_TAGS = new Set(['template', 'script', 'style'])

function isExternalVueTemplate(id: string): boolean {
  const queryStart = id.indexOf('?')
  if (queryStart === -1) return false

  const filename = id.slice(0, queryStart)
  const query = new URLSearchParams(id.slice(queryStart + 1))
  return (
    filename.endsWith('.html') &&
    query.has('vue') &&
    query.get('type') === 'template' &&
    query.has('src')
  )
}

function getInspectorInsertOffset(node: ElementNode): number {
  if (node.props.length === 0) return node.loc.start.offset + node.tag.length + 1
  return Math.max(...node.props.map((property) => property.loc.end.offset))
}

function addInspectorMetadata(source: string, id: string): string {
  const filename = normalizePath(id.slice(0, id.indexOf('?')))
  const sourcePath = normalizePath(relative(process.cwd(), filename))
  const insertions: Array<{ offset: number; content: string }> = []
  const ast = parse(source, { comments: true })

  transform(ast, {
    nodeTransforms: [
      (node) => {
        if (node.type !== NodeTypes.ELEMENT) return
        if (node.tagType !== ElementTypes.ELEMENT && node.tagType !== ElementTypes.COMPONENT) return
        if (
          INSPECTOR_EXCLUDED_TAGS.has(node.tag) ||
          node.loc.source.includes(INSPECTOR_ATTRIBUTE)
        ) {
          return
        }

        const { line, column } = node.loc.start
        insertions.push({
          offset: getInspectorInsertOffset(node),
          content: ` ${INSPECTOR_ATTRIBUTE}="${sourcePath}:${line}:${column}"`
        })
      }
    ]
  })

  let transformedSource = source
  for (const insertion of insertions.sort((a, b) => b.offset - a.offset)) {
    transformedSource =
      transformedSource.slice(0, insertion.offset) +
      insertion.content +
      transformedSource.slice(insertion.offset)
  }
  return transformedSource
}

export function externalSfcSetupPlugin(): Plugin {
  const ownersBySetupFile = new Map<string, Set<string>>()
  let serveMode = false

  return {
    name: 'external-sfc-setup',
    enforce: 'pre',
    configResolved(config) {
      serveMode = config.command === 'serve'
    },
    async transform(source, id) {
      if (serveMode && isExternalVueTemplate(id)) {
        return { code: addInspectorMetadata(source, id), map: null }
      }

      const componentId = normalizePath(id.split('?', 1)[0] ?? id)
      if (!componentId.endsWith('.vue') || !source.includes(' source=')) return null

      let transformedSource = source
      const matches = [...source.matchAll(EXTERNAL_SETUP_BLOCK)]

      for (const match of matches) {
        const [, attributesBefore, relativePath, attributesAfter] = match
        const externalPath = resolve(dirname(componentId), relativePath)
        const normalizedExternalPath = normalizePath(externalPath)
        const setupSource = await readFile(externalPath, 'utf8')
        const owners = ownersBySetupFile.get(normalizedExternalPath) ?? new Set<string>()
        owners.add(componentId)
        ownersBySetupFile.set(normalizedExternalPath, owners)
        this.addWatchFile(externalPath)
        transformedSource = transformedSource.replace(
          match[0],
          () => `<script${attributesBefore}${attributesAfter}>\n${setupSource}\n</script>`
        )
      }

      return { code: transformedSource, map: null }
    },
    handleHotUpdate({ file, server }) {
      const owners = ownersBySetupFile.get(normalizePath(file))
      if (!owners) return

      const affectedModules = new Set<ModuleNode>()
      for (const owner of owners) {
        const modules = server.moduleGraph.getModulesByFile(owner)
        if (!modules) continue
        for (const module of modules) {
          server.moduleGraph.invalidateModule(module)
          affectedModules.add(module)
        }
      }
      return [...affectedModules]
    }
  }
}
