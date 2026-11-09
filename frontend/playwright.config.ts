import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontend = resolve(fileURLToPath(new URL('.', import.meta.url)))
const backend = resolve(frontend, '../backend')
const venvPython = resolve(backend, process.platform === 'win32'
  ? '.venv/Scripts/python.exe'
  : '.venv/bin/python')
const python = process.env.PYTHON || (existsSync(venvPython) ? venvPython : 'python')

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `"${python}" -m uvicorn app.main:app --host 127.0.0.1 --port 8000`,
      cwd: backend,
      url: 'http://127.0.0.1:8000/openapi.json',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm run dev',
      cwd: frontend,
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
})
