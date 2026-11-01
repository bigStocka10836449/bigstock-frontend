import type { Plugin } from 'vite'

import JavaScriptObfuscator from 'javascript-obfuscator'

export interface ChartObfuscationOptions {
  enabled: boolean
  targetPaths?: string[]
  threshold?: number
}

/**
 * BigStock Chart Obfuscation Plugin
 *
 * 混淆單位：JavaScript Chunk
 *
 * 如果 Chunk 包含第三方函式庫，
 * 第一階段先跳過，避免影響 ECharts 等套件。
 */
export function chartObfuscationPlugin(options: ChartObfuscationOptions): Plugin {
  const targetPaths = (
    options.targetPaths ?? ['/src/utils/marketIndicators.ts', '/src/utils/marketHistoryParser.ts']
  ).map((path) => path.replace(/\\/g, '/'))

  let matched = 0

  return {
    name: 'bigstock-chart-obfuscation',

    apply: 'build',

    enforce: 'post',

    generateBundle(_options, bundle) {
      matched = 0

      if (!options.enabled) {
        this.warn('[BigStock] Chart obfuscation disabled for this build')

        return
      }

      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') {
          continue
        }

        if (!chunk.fileName.endsWith('.js')) {
          continue
        }

        const moduleIds = Object.keys(chunk.modules).map((path) => path.replace(/\\/g, '/'))

        // 找出需要保護的模組
        const selected = moduleIds.filter((id) => targetPaths.some((path) => id.includes(path)))

        if (selected.length === 0) {
          continue
        }

        // 避免混淆第三方函式庫
        const thirdParty = moduleIds.filter((id) => id.includes('/node_modules/'))

        if (thirdParty.length > 0) {
          this.warn(
            `[BigStock] Skipping ${chunk.fileName}: ` +
              `${thirdParty.length} third-party modules found.`,
          )

          continue
        }

        const originalSize = Buffer.byteLength(chunk.code, 'utf8')

        // ====================================================
        // JavaScript Obfuscation
        // ====================================================

        const result = JavaScriptObfuscator.obfuscate(chunk.code, {
          compact: true,

          identifierNamesGenerator: 'hexadecimal',

          controlFlowFlattening: true,

          controlFlowFlatteningThreshold: options.threshold ?? 0.15,

          stringArray: true,

          stringArrayThreshold: 0.7,

          stringArrayEncoding: ['base64'],

          stringArrayRotate: true,

          stringArrayShuffle: true,

          deadCodeInjection: false,

          renameGlobals: false,

          renameProperties: false,

          // 不停用 console.warn/error
          disableConsoleOutput: false,

          debugProtection: false,

          selfDefending: false,

          sourceMap: false,

          seed: 2026,
        })

        chunk.code = result.getObfuscatedCode()

        matched++

        const newSize = Buffer.byteLength(chunk.code, 'utf8')

        this.warn(
          `[BigStock] Obfuscated ${chunk.fileName}: ` +
            `${originalSize} -> ${newSize} bytes; ` +
            `sources: ${selected.join(', ')}`,
        )
      }

      if (!matched) {
        this.warn('[BigStock] No isolated chart chunk was obfuscated.')
      }
    },
  }
}
