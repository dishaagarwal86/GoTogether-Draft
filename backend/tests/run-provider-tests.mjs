import { createHmac } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer, request } from 'node:http'

// The application always has explicit test-only settings. No real .env values
// are used, and the runner never connects to a hosted database or sends emails.
const databaseUrl = 'postgres://provider_test:provider_test@127.0.0.1:55436/gotogether_provider_test'
const restUrl = 'http://127.0.0.1:55437'
const secret = 'gotogether-provider-contract-test-only-secret-2026'
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role: 'provider_test', exp: Math.floor(Date.now() / 1000) + 3600 })}`
const token = `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`

// Supabase's SDK expects /rest/v1; a tiny local proxy supplies that prefix for
// an actual PostgREST server. Queries and writes are not mocked.
const proxy = createServer((incoming, outgoing) => {
  if (!incoming.url?.startsWith('/rest/v1/')) { outgoing.writeHead(404).end(); return }
  const upstream = request(`${restUrl}${incoming.url.slice('/rest/v1'.length)}`, { method: incoming.method, headers: incoming.headers }, (response) => {
    outgoing.writeHead(response.statusCode ?? 502, response.headers)
    response.pipe(outgoing)
  })
  upstream.on('error', () => { outgoing.writeHead(502).end('Local PostgREST test server is unavailable.') })
  incoming.pipe(upstream)
})

async function run(provider, args) {
  const env = { ...process.env, DATABASE_PROVIDER: provider, DATABASE_URL: databaseUrl,
    SUPABASE_URL: `http://127.0.0.1:${proxy.address().port}`, SUPABASE_SERVICE_ROLE_KEY: token,
    OPENAI_API_KEY: '', OLLAMA_API_KEY: '', SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASS: '', SMTP_FROM: '',
    APP_URL: 'http://localhost:5173', DOTENV_CONFIG_PATH: '/dev/null', NODE_ENV: 'test' }
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${provider} test process failed (${code}).`)))
  })
}

try {
  const response = await fetch(restUrl)
  if (!response.ok) throw new Error(`PostgREST returned ${response.status}`)
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve))
  for (const provider of ['postgres', 'supabase']) {
    console.log(`\nProvider contract: ${provider}`)
    await run(provider, ['--import', 'tsx', '--test', 'tests/providers.integration.test.ts'])
    await run(provider, ['--import', 'tsx', '../database/seeds/seedItineraryCatalogue.ts'])
    await run(provider, ['--import', 'tsx', '../database/seeds/seedItineraryCatalogue.ts'])
    await run(provider, ['--import', 'tsx', '--test', 'tests/catalogue.integration.test.ts'])
    await run(provider, ['--import', 'tsx', '--test', 'tests/ai.integration.test.ts'])
  }
} catch (error) {
  console.error(error.message)
  console.error('Start the isolated fixtures with: docker compose -f backend/tests/docker-compose.yml up -d --wait')
  process.exitCode = 1
} finally {
  proxy.closeAllConnections()
  await new Promise((resolve) => proxy.close(resolve))
}
