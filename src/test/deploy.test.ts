import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

const root = process.cwd()
const readText = (relative: string) => readFileSync(resolve(root, relative), 'utf8')
const singleFileScript = resolve(root, 'scripts/build-single.mjs')

const tempDirs: string[] = []
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
})

/** A miniature dist/ folder shaped exactly like a Vite build output. */
function makeDistFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'market-sim-single-'))
  tempDirs.push(dir)
  mkdirSync(join(dir, 'assets'), { recursive: true })
  writeFileSync(join(dir, 'assets', 'app.css'), '.terminal { color: #00ff88; }')
  writeFileSync(join(dir, 'assets', 'app.js'), 'console.log("terminal ready")')
  writeFileSync(join(dir, 'icon.ico'), Buffer.from([0x00, 0x00, 0x01, 0x00]))
  writeFileSync(
    join(dir, 'index.html'),
    [
      '<!doctype html>',
      '<html lang="en"><head>',
      '<link rel="icon" type="image/x-icon" href="./icon.ico" />',
      '<link rel="stylesheet" crossorigin href="./assets/app.css">',
      '<link rel="modulepreload" crossorigin href="./assets/app.js">',
      '</head><body><div id="root"></div>',
      '<script type="module" crossorigin src="./assets/app.js"></script>',
      '</body></html>',
    ].join('\n'),
  )
  return dir
}

describe('static deploy configuration', () => {
  it('builds with relative asset paths so any subpath or file:// works', () => {
    const config = readText('vite.config.ts')
    expect(config).toContain("base: './'")
    // The vitest config must survive the base change.
    expect(config).toContain("environment: 'jsdom'")
    expect(config).toContain('setupFiles')
  })

  it('exposes a build:single npm script', () => {
    const pkg = JSON.parse(readText('package.json')) as { scripts: Record<string, string> }
    expect(pkg.scripts['build:single']).toBe('npm run build && node scripts/build-single.mjs')
  })

  it('ships a GitHub Pages workflow that publishes dist/ with deploy-pages', () => {
    const workflow = readText('.github/workflows/deploy.yml')
    expect(workflow).toContain('actions/upload-pages-artifact')
    expect(workflow).toContain('actions/deploy-pages')
    expect(workflow).toContain('path: ./dist')
    expect(workflow).toContain('pages: write')
    expect(workflow).toContain('id-token: write')
    expect(workflow).toContain('group: pages')
    expect(workflow).toContain('node-version: 20')
    expect(workflow).toContain('cache: npm')
    expect(workflow).toContain('npm ci')
    expect(workflow).toContain('npm run build')
  })

  it('ships Netlify build + publish settings', () => {
    const netlify = readText('netlify.toml')
    expect(netlify).toContain('command = "npm run build"')
    expect(netlify).toContain('publish = "dist"')
  })
})

describe('single-file build', () => {
  it('inlines CSS, JS and the favicon into one standalone document', () => {
    const dir = makeDistFixture()
    const output = join(dir, 'dist-single', 'index.html')

    execFileSync(process.execPath, [singleFileScript, join(dir, 'index.html'), output], {
      cwd: root,
      stdio: 'pipe',
    })

    const html = readFileSync(output, 'utf8')
    // CSS became an inline <style>, JS an inline module script.
    expect(html).toContain('<style>.terminal { color: #00ff88; }</style>')
    expect(html).toContain('<script type="module">console.log("terminal ready")</script>')
    // The icon is a data URI and the preload hint is gone.
    expect(html).toContain('data:image/x-icon;base64,')
    expect(html).not.toContain('modulepreload')
    // Nothing may still point at the external asset directory.
    expect(html).not.toContain('./assets/')
    expect(html).not.toContain('src="./assets')
  })

  it('fails with an actionable message when there is no production build', () => {
    const dir = makeDistFixture()
    const result = spawnSync(
      process.execPath,
      [singleFileScript, join(dir, 'missing', 'index.html'), join(dir, 'dist-single', 'index.html')],
      { cwd: root, encoding: 'utf8' },
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('run "npm run build" first')
  })
})

describe('README', () => {
  it('documents how to publish a link at the end of the file', () => {
    const readme = readText('README.md')
    const sectionStart = readme.indexOf('## Publish a link')
    expect(sectionStart).toBeGreaterThan(-1)
    expect(sectionStart).toBeGreaterThan(readme.indexOf('## Working rules'))

    const section = readme.slice(sectionStart)
    expect(section).toContain('GitHub Pages')
    expect(section).toContain('github.io')
    expect(section).toContain('Netlify Drop')
    expect(section).toContain('build:single')
    expect(section).toContain('double-click')
    expect(section).toMatch(/client-side|no backend/i)
  })
})
