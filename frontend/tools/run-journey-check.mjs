import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const apiUrl = 'http://127.0.0.1:3016'
const uiUrl = 'http://127.0.0.1:5186'
const databaseUrl = 'postgres://provider_test:provider_test@127.0.0.1:55436/gotogether_provider_test'
const children = []
const env = { ...process.env, NODE_ENV: 'test', DOTENV_CONFIG_PATH: '/dev/null', DATABASE_PROVIDER: 'postgres', DATABASE_URL: databaseUrl, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASS: '', SMTP_FROM: '', OPENAI_API_KEY: '', OLLAMA_API_KEY: '', PORT: '3016', CLIENT_ORIGIN: uiUrl, APP_URL: uiUrl }
function start(args, cwd, childEnv, readyText) {
  return new Promise((resolveReady, reject) => {
    const child = spawn(process.execPath, args, { cwd, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] })
    children.push(child)
    const timer = setTimeout(() => reject(new Error('Local test server did not start. Check that the isolated database fixtures are running.')), 35000)
    child.stdout.on('data', (chunk) => { if (String(chunk).includes(readyText)) { clearTimeout(timer); resolveReady(child) } })
    child.stderr.on('data', (chunk) => process.stderr.write(chunk))
    child.on('error', (error) => { clearTimeout(timer); reject(error) })
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Local test server exited (${code}). Ports 3016 and 5186 must be available.`)) })
  })
}
try {
  await start(['dist/index.js'], resolve(root, 'backend'), env, 'GoTogether API listening')
  await start(['node_modules/vite/bin/vite.js', '--port', '5186', '--host', '127.0.0.1', '--strictPort'], resolve(root, 'frontend'), { ...env, API_PROXY_TARGET: apiUrl }, 'Local:')
  const code = await new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, ['tools/check-journey.mjs'], { cwd: resolve(root, 'frontend'), env: { ...env, JOURNEY_TEST_URL: uiUrl }, stdio: 'inherit' })
    children.push(child)
    child.on('error', reject)
    child.on('exit', resolveExit)
  })
  if (code !== 0) process.exitCode = 1
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM')
}
