#!/usr/bin/env node
/**
 * Single-file build: take the regular Vite output (dist/index.html plus
 * dist/assets/*.css / *.js) and inline every CSS and JS asset into one
 * self-contained HTML document at dist-single/index.html.
 *
 * The result has zero external references (the favicon is inlined as a data
 * URI), so it runs by double-clicking the file: no server, no install.
 *
 * Zero dependencies: Node >= 18, ESM.
 *
 * Usage:
 *   node scripts/build-single.mjs [input.html] [output.html]
 *
 * Defaults: dist/index.html -> dist-single/index.html (relative to the repo root).
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')

export const DEFAULT_INPUT = resolve(repoRoot, 'dist/index.html')
export const DEFAULT_OUTPUT = resolve(repoRoot, 'dist-single/index.html')

const MIME_BY_EXT = {
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

/** Read one attribute out of an HTML tag string. */
function attr(tag, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag)
  return match ? (match[2] ?? match[3] ?? '') : null
}

/**
 * Resolve an asset reference from index.html to an absolute path.
 * Returns null for URLs we must leave alone (data:, http:, protocol-relative).
 */
function resolveAssetPath(ref, htmlDir, rootDir) {
  const clean = ref.split(/[?#]/, 1)[0].trim()
  if (!clean || /^(?:data:|https?:|\/\/|mailto:|#)/i.test(clean)) return null
  if (clean.startsWith('/')) return resolve(rootDir, clean.slice(1))
  return resolve(htmlDir, clean)
}

function readAsset(file, warnings) {
  if (!existsSync(file)) {
    throw new Error(`[build-single] missing asset referenced by index.html: ${file}`)
  }
  return readFileSync(file)
}

function displayPath(file) {
  const relative = file.replace(/^[A-Za-z]:/, '').replaceAll('\\', '/')
  return relative.startsWith('/') ? relative.slice(1) : relative
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`
}

/**
 * Pure-ish transform: inline stylesheets, module scripts and the favicon.
 *
 * @param {string} html index.html source
 * @param {{ htmlDir?: string, rootDir?: string, warnings?: string[] }} [options]
 * @returns {{ html: string, inlined: { kind: string, from: string, bytes: number }[] }}
 */
export function inlineHtml(html, options = {}) {
  const htmlDir = options.htmlDir ?? dirname(DEFAULT_INPUT)
  const rootDir = options.rootDir ?? repoRoot
  const warnings = options.warnings ?? []
  /** @type {{ kind: string, from: string, bytes: number }[]} */
  const inlined = []

  let out = html

  // 1. <link> tags: stylesheets get inlined, modulepreload hints are dropped,
  //    the favicon becomes a data URI. Anything else is left untouched.
  out = out.replace(/<link\b[^>]*>/gi, (tag) => {
    const rel = (attr(tag, 'rel') ?? '').toLowerCase()
    const href = attr(tag, 'href')

    if (rel.split(/\s+/).includes('modulepreload')) {
      warnings.push('dropped modulepreload hint (assets are inlined)')
      return ''
    }

    if (rel.split(/\s+/).includes('stylesheet') && href) {
      const file = resolveAssetPath(href, htmlDir, rootDir)
      if (!file) return tag
      const css = readAsset(file, warnings).toString('utf8')
      if (/<\/style/i.test(css)) {
        throw new Error(`[build-single] stylesheet contains a literal </style: ${file}`)
      }
      inlined.push({ kind: 'stylesheet', from: displayPath(file), bytes: Buffer.byteLength(css) })
      return `<style>${css.trim()}</style>`
    }

    if (rel.split(/\s+/).includes('icon') && href) {
      const file = resolveAssetPath(href, htmlDir, rootDir)
      if (!file || !existsSync(file)) {
        warnings.push(`dropped favicon link because the file is unavailable: ${href}`)
        return ''
      }
      const mime = MIME_BY_EXT[extname(file).toLowerCase()] ?? 'application/octet-stream'
      const bytes = readAsset(file, warnings)
      inlined.push({ kind: 'icon', from: displayPath(file), bytes: bytes.length })
      return `<link rel="icon" type="${mime}" href="data:${mime};base64,${bytes.toString('base64')}" />`
    }

    return tag
  })

  // 2. Bundled module scripts: inline the code, drop src/crossorigin attributes.
  out = out.replace(/<script\b[^>]*\bsrc\s*=\s*("([^"]*)"|'([^']*)')[^>]*>\s*<\/script\s*>/gi, (tag, _quoted, dq, sq) => {
    const src = dq ?? sq ?? ''
    const file = resolveAssetPath(src, htmlDir, rootDir)
    if (!file) return tag
    let js = readAsset(file, warnings).toString('utf8')
    // Inline scripts must not contain the closing tag sequence (even inside strings).
    js = js.replace(/<\/script/gi, '<\\/script')
    inlined.push({ kind: 'script', from: displayPath(file), bytes: Buffer.byteLength(js) })
    return `<script type="module">${js.trim()}</script>`
  })

  // 3. Anything still pointing at a relative ./assets/ path would break file://.
  const leftover = out.match(/(?:src|href)\s*=\s*["'](?:\.\/)?assets\/[^"']+["']/gi)
  if (leftover) {
    throw new Error(
      `[build-single] index.html still references external assets after inlining: ${leftover.join(', ')}`,
    )
  }

  return { html: out, inlined }
}

function formatStats(inlined) {
  return inlined
    .map(({ kind, from, bytes }) => `  ${kind}: ${from} (${kb(bytes)})`)
    .join('\n')
}

/** Build dist-single/index.html from an existing dist build. */
export function buildSingleFile(input = DEFAULT_INPUT, output = DEFAULT_OUTPUT) {
  if (!existsSync(input)) {
    throw new Error(`[build-single] ${displayPath(input)} not found — run "npm run build" first.`)
  }

  const htmlDir = dirname(input)
  const warnings = []
  const source = readFileSync(input, 'utf8')
  const { html, inlined } = inlineHtml(source, { htmlDir, rootDir: htmlDir, warnings })
  const htmlBytes = Buffer.byteLength(html)

  if (inlined.length === 0) {
    throw new Error(
      `[build-single] ${displayPath(input)} had no stylesheet/script/favicon tags to inline; ` +
        'is it really the Vite production build?',
    )
  }

  const nonDataUrls = html.match(/url\(\s*["']?(?!data:)[^)]+\)/gi)
  if (nonDataUrls) {
    warnings.push(`stylesheet still contains url() references: ${nonDataUrls.join(', ')}`)
  }

  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, html, 'utf8')

  console.log(`[build-single] input:  ${displayPath(input)} (${kb(statSync(input).size)})`)
  console.log(`[build-single] inlined:\n${formatStats(inlined)}`)
  for (const warning of warnings) console.log(`[build-single] warning: ${warning}`)
  console.log(`[build-single] output: ${displayPath(output)} (${kb(htmlBytes)} single file)`)

  return { output, bytes: htmlBytes, inlined, warnings }
}

function main() {
  const [inputArg, outputArg] = process.argv.slice(2)
  const input = inputArg ? resolve(process.cwd(), inputArg) : DEFAULT_INPUT
  const output = outputArg ? resolve(process.cwd(), outputArg) : DEFAULT_OUTPUT

  try {
    buildSingleFile(input, output)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

const selfUrl = pathToFileURL(fileURLToPath(import.meta.url)).href
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href.toLowerCase() === selfUrl.toLowerCase()) {
  main()
}
