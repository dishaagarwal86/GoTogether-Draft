import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const preview = process.argv.includes('--preview')
const apiPort = preview ? '3017' : '3016'
const uiPort = preview ? '5191' : '5186'
const apiUrl = `http://127.0.0.1:${apiPort}`
const uiUrl = `http://127.0.0.1:${uiPort}`
const directApi = process.env.JOURNEY_DIRECT_API === '1'
const databaseUrl = 'postgres://provider_test:provider_test@127.0.0.1:55436/gotogether_provider_test'
const children = []
const env = { ...process.env, NODE_ENV: 'test', DOTENV_CONFIG_PATH: '/dev/null', DATABASE_PROVIDER: 'postgres', DATABASE_URL: databaseUrl, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASS: '', SMTP_FROM: '', OPENAI_API_KEY: '', OLLAMA_API_KEY: '', PORT: apiPort, CLIENT_ORIGIN: uiUrl, APP_URL: uiUrl, VITE_API_URL: directApi ? apiUrl : '', VITE_API_BASE_URL: '', JOURNEY_TEST_API_URL: directApi ? apiUrl : uiUrl }
function start(args, cwd, childEnv, readyText) {
  return new Promise((resolveReady, reject) => {
    const child = spawn(process.execPath, args, { cwd, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] })
    children.push(child)
    const timer = setTimeout(() => reject(new Error('Local test server did not start. Check that the isolated database fixtures are running.')), 35000)
    child.stdout.on('data', (chunk) => { if (String(chunk).includes(readyText)) { clearTimeout(timer); resolveReady(child) } })
    child.stderr.on('data', (chunk) => process.stderr.write(chunk))
    child.on('error', (error) => { clearTimeout(timer); reject(error) })
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Local test server exited (${code}). Ports ${apiPort} and ${uiPort} must be available.`)) })
  })
}
try {
  await start(['dist/index.js'], resolve(root, 'backend'), env, 'GoTogether API listening')
  await start(['node_modules/vite/bin/vite.js', '--port', uiPort, '--host', '127.0.0.1', '--strictPort'], resolve(root, 'frontend'), { ...env, API_PROXY_TARGET: apiUrl }, 'Local:')
  if (preview) {
    console.log(`Workspace preview: ${uiUrl}/workspace-preview\nQuick start: ${uiUrl}/travel-dna/new\nUses the isolated test database; create a local account to save trips. External AI and email are disabled.`)
    await new Promise(resolveStop => { process.once('SIGINT', resolveStop); process.once('SIGTERM', resolveStop) })
  } else {
  const scripts = process.env.JOURNEY_TEST_SCRIPT ? [process.env.JOURNEY_TEST_SCRIPT] : ['tools/check-workspace.mjs', 'tools/check-journey.mjs']
  for (const script of scripts) {
  const code = await new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, [script], { cwd: resolve(root, 'frontend'), env: { ...env, JOURNEY_TEST_URL: uiUrl }, stdio: 'inherit' })
    children.push(child)
    child.on('error', reject)
    child.on('exit', resolveExit)
  })
  if (code !== 0) { process.exitCode = 1; break }
  }
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM')
}
