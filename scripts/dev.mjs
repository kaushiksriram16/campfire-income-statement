import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isWindows = process.platform === 'win32'
const pythonInVenv = join(root, 'backend', '.venv', isWindows ? 'Scripts/python.exe' : 'bin/python')
const python = process.env.PYTHON || pythonInVenv

if (!process.env.PYTHON && !existsSync(pythonInVenv)) {
  console.error('Backend virtual environment not found. Follow the README one-time installation steps.')
  process.exit(1)
}

const services = []
let terminating = false
let exitCode = 0
let running = 0

function killTree(child) {
  if (!child.pid || child.exitCode !== null) return
  if (isWindows) {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    try { process.kill(-child.pid, 'SIGTERM') } catch { /* Already exited */ }
  }
}

function stop(code = 0) {
  if (terminating) return
  terminating = true
  exitCode = code
  for (const child of services) killTree(child)
  if (running === 0) process.exit(exitCode)
}

function start(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd, stdio: 'inherit', detached: !isWindows, windowsHide: false,
    env: process.env,
  })
  services.push(child)
  running++
  child.on('error', (error) => {
    console.error(`[${name}] Failed to launch:`, error.message)
    stop(1)
  })
  child.on('exit', (code, signal) => {
    running--
    if (!terminating) {
      console.error(`[${name}] exited (${code ?? signal}). Stopping both services.`)
      stop(code ?? 1)
    }
    if (terminating && running === 0) process.exit(exitCode)
  })
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))

start('FastAPI', python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000', '--reload'], join(root, 'backend'))
if (!terminating) {
  if (isWindows) {
    start('Vite', 'cmd.exe', ['/d', '/s', '/c', 'npm run dev'], join(root, 'frontend'))
  } else {
    start('Vite', 'npm', ['run', 'dev'], join(root, 'frontend'))
  }
}
