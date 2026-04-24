import fs from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const currentNodeVersion = `v${process.versions.node}`

function parseVersion(version) {
  const match = /^v?(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$/.exec(version)

  if (!match?.groups) {
    return null
  }

  return {
    major: Number(match.groups.major),
    minor: Number(match.groups.minor),
    patch: Number(match.groups.patch),
  }
}

function compareVersions(left, right) {
  if (left.major !== right.major) {
    return left.major - right.major
  }

  if (left.minor !== right.minor) {
    return left.minor - right.minor
  }

  return left.patch - right.patch
}

function isViteCompatible(version) {
  if (!version) {
    return false
  }

  if (version.major < 20 || version.major === 21) {
    return false
  }

  if (version.major === 20) {
    return compareVersions(version, { major: 20, minor: 19, patch: 0 }) >= 0
  }

  if (version.major === 22) {
    return compareVersions(version, { major: 22, minor: 12, patch: 0 }) >= 0
  }

  return version.major > 22
}

function resolvePreferredNode() {
  const parsedCurrentVersion = parseVersion(currentNodeVersion)

  if (isViteCompatible(parsedCurrentVersion)) {
    return { path: process.execPath, version: currentNodeVersion }
  }

  const nvmHome = process.env.NVM_HOME

  if (!nvmHome || !fs.existsSync(nvmHome)) {
    return { path: process.execPath, version: currentNodeVersion }
  }

  const candidates = fs
    .readdirSync(nvmHome, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => /^v\d+\.\d+\.\d+$/.test(name))
    .map((name) => ({ name, parsed: parseVersion(name) }))
    .filter((entry) => isViteCompatible(entry.parsed))
    .sort((left, right) => compareVersions(right.parsed, left.parsed))

  for (const candidate of candidates) {
    const executable = path.join(
      nvmHome,
      candidate.name,
      process.platform === 'win32' ? 'node.exe' : path.join('bin', 'node'),
    )

    if (fs.existsSync(executable)) {
      return { path: executable, version: candidate.name }
    }
  }

  return { path: process.execPath, version: currentNodeVersion }
}

const preferredNode = resolvePreferredNode()
const nodeBin = preferredNode.path
const clientArgs = [path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js')]

if (process.env.CLIENT_HOST) {
  clientArgs.push('--host', process.env.CLIENT_HOST)
}

if (process.env.CLIENT_PORT) {
  clientArgs.push('--port', process.env.CLIENT_PORT)
}

if (preferredNode.path !== process.execPath) {
  console.log(`[dev] Using ${preferredNode.version} for the client and server.`)
}

const commands = [
  {
    name: 'server',
    command: nodeBin,
    args: [path.join(rootDir, 'server', 'index.js')],
  },
  {
    name: 'client',
    command: nodeBin,
    args: clientArgs,
  },
]

const children = new Map()
let shuttingDown = false

function writePrefixedLines(stream, target, label) {
  let pending = ''
  stream.setEncoding('utf8')
  stream.on('data', (chunk) => {
    pending += chunk

    while (true) {
      const newlineIndex = pending.indexOf('\n')

      if (newlineIndex === -1) {
        break
      }

      const line = pending.slice(0, newlineIndex).replace(/\r$/, '')
      pending = pending.slice(newlineIndex + 1)
      target.write(`[${label}] ${line}\n`)
    }
  })

  stream.on('end', () => {
    if (pending) {
      target.write(`[${label}] ${pending.replace(/\r$/, '')}\n`)
    }
  })
}

function maybeExit() {
  if (!shuttingDown) {
    return
  }

  const hasRunningChildren = [...children.values()].some(
    (child) => child.exitCode === null && child.signalCode === null,
  )

  if (!hasRunningChildren) {
    process.exit(process.exitCode ?? 0)
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  process.exitCode = exitCode

  for (const child of children.values()) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM')
    }
  }

  setTimeout(() => {
    for (const child of children.values()) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL')
      }
    }

    maybeExit()
  }, 3000).unref()

  maybeExit()
}

for (const { name, command, args } of commands) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: process.env,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  children.set(name, child)
  writePrefixedLines(child.stdout, process.stdout, name)
  writePrefixedLines(child.stderr, process.stderr, name)

  child.on('error', (error) => {
    console.error(`[${name}] Failed to start: ${error.message}`)
    shutdown(1)
  })

  child.on('exit', (code, signal) => {
    const stoppedDuringShutdown = shuttingDown

    if (!stoppedDuringShutdown && (code !== 0 || signal)) {
      const detail = signal ? `signal ${signal}` : `exit code ${code}`
      console.error(`[${name}] Stopped with ${detail}`)
      shutdown(code ?? 1)
      return
    }

    maybeExit()
  })
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(0))
}
