import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const root = resolve(import.meta.dirname, '../..')
const preview = process.argv.includes('--preview')
const apiPort = process.env.JOURNEY_API_PORT || (preview ? '3017' : '3016')
const uiPort = process.env.JOURNEY_UI_PORT || (preview ? '5191' : '5186')
const apiUrl = `http://127.0.0.1:${apiPort}`
const uiUrl = `http://127.0.0.1:${uiPort}`
const directApi = process.env.JOURNEY_DIRECT_API === '1'
const selectedScript = process.env.JOURNEY_TEST_SCRIPT || process.argv.find(arg => arg.startsWith('--script='))?.slice('--script='.length)
const databaseUrl = 'postgres://provider_test:provider_test@127.0.0.1:55436/gotogether_provider_test'
const children = []
let stopping = false
let stopPreview = () => {}
const env = { ...process.env, NODE_ENV: 'test', LOCAL_QUEST_DEMO: preview ? 'true' : '', DOTENV_CONFIG_PATH: '/dev/null', DATABASE_PROVIDER: 'postgres', DATABASE_URL: databaseUrl, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASS: '', SMTP_FROM: '', OPENAI_API_KEY: '', OLLAMA_API_KEY: '', PORT: apiPort, CLIENT_ORIGIN: `${uiUrl},http://localhost:${uiPort}`, APP_URL: uiUrl, VITE_API_URL: directApi ? apiUrl : '', VITE_API_BASE_URL: '', VITE_LOCAL_PREVIEW: preview ? 'true' : '', JOURNEY_TEST_API_URL: directApi ? apiUrl : uiUrl }
// Review the real AI experience locally without importing hosted DB or mail settings.
const aiKeys = ['AI_PROVIDER', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENAI_ITINERARY_MODEL', 'OLLAMA_API_KEY', 'OLLAMA_MODEL', 'OLLAMA_ITINERARY_MODEL', 'OLLAMA_BASE_URL']
if (preview && existsSync(resolve(root, 'backend/.env'))) {
  const { parse } = createRequire(resolve(root, 'backend/package.json'))('dotenv')
  const settings = parse(readFileSync(resolve(root, 'backend/.env')))
  for (const key of aiKeys) env[key] = settings[key] ?? ''
}
function start(args, cwd, childEnv, readyText, restarts = 0) {
  return new Promise((resolveReady, reject) => {
    let ready = false
    const child = spawn(process.execPath, args, { cwd, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] })
    children.push(child)
    const timer = setTimeout(() => reject(new Error('Local test server did not start. Check that the isolated database fixtures are running.')), 35000)
    child.stdout.on('data', (chunk) => { if (String(chunk).includes(readyText)) { ready = true; clearTimeout(timer); resolveReady(child) } })
    child.stderr.on('data', (chunk) => process.stderr.write(chunk))
    child.on('error', (error) => { clearTimeout(timer); reject(error) })
    child.on('exit', (code) => {
      clearTimeout(timer)
      if (!ready) { reject(new Error(`Local server exited (${code}). Ports ${apiPort} and ${uiPort} must be available.`)); return }
      if (preview && !stopping) {
        console.error(`Local server stopped (${code}); restarting to restore the preview.`)
        if (restarts >= 3) { process.exitCode = 1; stopPreview(); return }
        setTimeout(() => { if (!stopping) void start(args, cwd, childEnv, readyText, restarts + 1).catch(error => { console.error(error.message); process.exitCode = 1; stopPreview() }) }, 500)
      }
    })
  })
}
try {
  await start(['dist/index.js'], resolve(root, 'backend'), env, 'GoTogether API listening')
  await start(['node_modules/vite/bin/vite.js', '--port', uiPort, '--host', '127.0.0.1', '--strictPort'], resolve(root, 'frontend'), { ...env, API_PROXY_TARGET: apiUrl }, 'Local:')
  if (preview) {
    console.log(`Workspace preview: http://localhost:${uiPort}/workspace-preview\nQuick start: http://localhost:${uiPort}/travel-dna/new\nUses the isolated test database; create a local account to save trips. AI ${env.OPENAI_API_KEY || env.OLLAMA_API_KEY ? 'configured from backend/.env' : 'unavailable: add a key to backend/.env'}. Email is disabled.`)
    await new Promise(resolveStop => { stopPreview = resolveStop; process.once('SIGINT', resolveStop); process.once('SIGTERM', resolveStop) })
  } else {
  const scripts = selectedScript ? selectedScript.split(',') : ['tools/check-solo-journey.mjs', 'tools/check-group-journey.mjs', 'tools/check-workspace.mjs', 'tools/check-journey.mjs', 'tools/check-personalization.mjs', 'tools/check-generated-ui.mjs', 'tools/check-real-places.mjs', 'tools/check-presentation.mjs', 'tools/check-motion.mjs']
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
  stopping = true
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM')
}
