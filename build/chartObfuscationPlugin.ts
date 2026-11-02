import type { Plugin } from 'vite'
import JavaScriptObfuscator from 'javascript-obfuscator'

export interface ChartObfuscationOptions {
  enabled: boolean
  targetPaths?: string[]
  threshold?: number
}

/**
 * Obfuscation is applied to *chunks*, not individual source files.
 * Inspect the build log to ensure third-party libraries aren't co-bundled.
 */
export function chartObfuscationPlugin(options: ChartObfuscationOptions): Plugin {
  const targetPaths = (options.targetPaths ?? [
    '/src/utils/marketIndicators.ts',
    '/src/utils/marketHistoryParser.ts',
  ]).map((p) => p.replace(/\\/g, '/'))

  let matched = 0
  return {
    name: 'bigstock-chart-obfuscation',
    apply: 'build',
    enforce: 'post',
    // 在 hash 計算前改寫 Chunk，以免檔名 hash 對不上最終程式碼。
    renderChunk(code, chunk) {
      if (!options.enabled) return null

      const moduleIds = Object.keys(chunk.modules).map((p) => p.replace(/\\/g, '/'))
      const selected = moduleIds.filter((id) => targetPaths.some((p) => id.includes(p)))
      if (selected.length === 0) return null

      const thirdParty = moduleIds.filter((id) => id.includes('/node_modules/'))
      if (thirdParty.length > 0) {
        this.error(`[BigStock] Protected chunk contains ${thirdParty.length} third-party modules: ${chunk.fileName}`)
      }

      const result = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        identifierNamesGenerator: 'hexadecimal',
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: options.threshold ?? 0.15,
        deadCodeInjection: false,
        stringArray: true,
        stringArrayThreshold: 0.7,
        stringArrayEncoding: ['base64'],
        stringArrayRotate: true,
        stringArrayShuffle: true,
        renameGlobals: false,
        renameProperties: false,
        disableConsoleOutput: false,
        debugProtection: false,
        selfDefending: false,
        sourceMap: false,
        seed: 2026,
      })

      matched += 1
      const output = result.getObfuscatedCode()
      this.warn(`[BigStock] Obfuscated protected chunk (${selected.length} modules): ${Buffer.byteLength(code, 'utf8')} -> ${Buffer.byteLength(output, 'utf8')} bytes`)
      return { code: output, map: null }
    },

    generateBundle() {
      if (options.enabled && matched === 0) {
        this.error('[BigStock] Chart obfuscation was requested but no chart chunk was obfuscated.')
      }
    },
  }
}
