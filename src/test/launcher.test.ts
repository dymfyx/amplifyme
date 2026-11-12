import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (relative: string) => readFileSync(resolve(root, relative), 'utf8')

describe('desktop launcher', () => {
  const startScript = read('launcher/start-sim.ps1')

  it('serves the built terminal on the loopback port', () => {
    expect(startScript).toContain('npm run preview')
    expect(startScript).toContain('--host 127.0.0.1')
    expect(startScript).toContain('$Port = 4173')
  })

  it('builds the app first when dist is missing', () => {
    expect(startScript).toContain("dist\\index.html")
    expect(startScript).toContain('npm.cmd run build')
  })

  it('reuses a server that is already answering', () => {
    expect(startScript).toContain('Test-ServerUp')
    expect(startScript).toContain('if (-not (Test-ServerUp))')
  })

  it('opens the browser and can skip that for smoke tests', () => {
    expect(startScript).toContain('Start-Process $url')
    expect(startScript).toContain('[switch]$NoBrowser')
  })

  it('ships a stop script bound to the same port', () => {
    const stopScript = read('launcher/stop-sim.ps1')
    expect(stopScript).toContain('Get-NetTCPConnection -LocalPort $Port')
    expect(stopScript).toContain('Stop-Process')
    expect(stopScript).toContain('$Port = 4173')
  })

  it('installs a desktop shortcut pointing at the launcher and the icon', () => {
    const installScript = read('launcher/install-shortcut.ps1')
    expect(installScript).toContain('WScript.Shell')
    expect(installScript).toContain('start-sim.ps1')
    expect(installScript).toContain('icon.ico')
    expect(installScript).toContain("GetFolderPath('Desktop')")
  })
})

describe('icon asset', () => {
  it('is a real ico file', () => {
    const icon = readFileSync(resolve(root, 'public/icon.ico'))
    expect(icon.subarray(0, 4)).toEqual(Buffer.from([0x00, 0x00, 0x01, 0x00]))
    expect(icon.length).toBeGreaterThan(1024)
  })
})
