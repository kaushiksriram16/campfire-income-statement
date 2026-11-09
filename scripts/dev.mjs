import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isWindows = process.platform === 'win32'
const pythonInVenv = join(root, 'backend', '.venv', isWindows ? 'Scripts/python.exe' : 'bin/python')
const python = process.env.PYTHON || pythonInVenv

if (!process.env.PYTHON && !existsSync(pythonInVenv)) {
  console.error('Backend virtual environment not found. Run these commands from the repository root:')
  console.error(isWindows
    ? '  python -m venv backend/.venv\n  .\\backend\\.venv\\Scripts\\python.exe -m pip install -r backend/requirements-dev.txt'
    : '  python3 -m venv backend/.venv\n  backend/.venv/bin/python -m pip install -r backend/requirements-dev.txt')
  console.error('  npm ci --prefix frontend\n  npm run dev')
  process.exit(1)
}

const services = []
let terminating = false
let exitCode = 0
let running = 0

function killTree(child) {
  if (!child.pid || child.exitCode !== null) return
  if (isWindows) {
    spawnSync(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
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
    cwd, stdio: 'inherit', detached: !isWindows, windowsHide: true,
    env: process.env,
  })
  services.push(child)
  running++
  child.on('error', (error) => {
    console.error(`[${name}] Failed to launch:`, error.message)
    stop(1)
  })
  // `close` also fires after a failed spawn, which has no `exit` event.
  child.on('close', (code, signal) => {
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
  start('Vite', process.execPath, [join(root, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1'], join(root, 'frontend'))
}
