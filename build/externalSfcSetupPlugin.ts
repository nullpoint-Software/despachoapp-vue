import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { normalizePath, type ModuleNode, type Plugin } from 'vite'

const EXTERNAL_SETUP_BLOCK = /<script([^>]*?)\ssource=["']([^"']+)["']([^>]*)><\/script>/g

export function externalSfcSetupPlugin(): Plugin {
  const ownersBySetupFile = new Map<string, Set<string>>()

  return {
    name: 'external-sfc-setup',
    enforce: 'pre',
    async transform(source, id) {
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
