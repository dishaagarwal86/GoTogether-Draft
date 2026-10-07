import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, resolve, sep } from 'node:path'
import { chromium } from 'playwright'

const root = resolve(import.meta.dirname, '../..')
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', headless: true })
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff' }

// Serve actual production files, with only the committed rewrite rules providing
// the fallback. Vite dev/preview would hide a missing deployment configuration.
try {
  for (const configPath of ['vercel.json', 'frontend/vercel.json']) {
    const configFile = resolve(root, configPath)
    const config = JSON.parse(await readFile(configFile, 'utf8'))
    const output = resolve(dirname(configFile), config.outputDirectory)
    assert.equal(output, resolve(root, 'frontend/dist'))
    const entry = await readFile(resolve(output, 'index.html'), 'utf8')
    const entryScript = entry.match(/<script[^>]+src="([^"]+)"/)?.[1]
    assert.ok(entryScript, 'The production entry script is present')
    assert.ok((await readFile(resolve(output, `.${entryScript}`))).byteLength < 350_000, 'Keep the initial JavaScript bundle below 350KB')
    let rewritesEnabled = false
    const server = createServer(async (request, response) => {
      const pathname = new URL(request.url, 'http://localhost').pathname
      let path = pathname === '/' ? '/index.html' : pathname
      const serve = async () => {
        const file = resolve(output, `.${path}`)
        if (!file.startsWith(`${output}${sep}`)) return false
        try { const body = await readFile(file); response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }); response.end(body); return true }
        catch (error) { if (error.code !== 'ENOENT' && error.code !== 'EISDIR') throw error; return false }
      }
      try {
        if (await serve()) return
        const rewrite = rewritesEnabled && config.rewrites.find(rule => new RegExp(`^${rule.source}$`).test(pathname))
        if (rewrite) { path = rewrite.destination; if (await serve()) return }
        response.writeHead(404).end('NOT_FOUND')
      } catch { response.writeHead(500).end('Static test server failed') }
    })
    await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done) })
    const base = `http://127.0.0.1:${server.address().port}`
    const context = await browser.newContext()
    const page = await context.newPage()
    page.setDefaultTimeout(12000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    // No deployed API or external service is contacted by this regression check.
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
    try {
      assert.equal((await fetch(`${base}/plan`)).status, 404, 'Reproduces the missing SPA fallback')
      rewritesEnabled = true
      for (const path of ['/plan', '/login', '/signup', '/dashboard', '/trips', '/travel-dna/new', '/travel-dna/preferences', '/travel-dna/group-dna?roomId=test', '/quests/test', '/invite/test', '/join/test', '/join-room/test', '/quests/test?tab=options', '/explore', '/saved', '/profile', '/travel-style', '/workspace-preview']) {
        const result = await fetch(base + path)
        assert.equal(result.status, 200, `${configPath}: direct ${path}`)
        assert.equal(await result.text(), entry)
      }
      for (const [, asset] of entry.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
        const result = await fetch(base + asset)
        assert.equal(result.status, 200)
        assert.equal(result.headers.get('content-type'), types[extname(asset)])
        assert.notEqual(await result.text(), entry, 'Static assets must not be replaced with HTML')
      }
      await page.goto(base)
      await page.getByRole('link', { name: 'Start a quest', exact: true }).waitFor()
      const documentRequests = []
      page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentRequests.push(request.url()) })
      await page.getByRole('link', { name: 'Start a quest', exact: true }).click()
      await page.waitForURL('**/login?next=*')
      assert.equal(new URL(page.url()).searchParams.get('next'), '/travel-dna/new')
      await page.getByRole('heading', { name: 'Hello again, explorer.' }).waitFor()
      assert.deepEqual(documentRequests, [], 'The landing CTA navigates inside React Router')
      assert.equal((await page.reload()).status(), 200)
      await page.getByRole('heading', { name: 'Hello again, explorer.' }).waitFor()
      await page.getByRole('link', { name: 'Create an account', exact: false }).click()
      await page.waitForURL('**/signup?next=*')
      assert.equal(new URL(page.url()).searchParams.get('next'), '/travel-dna/new')
      assert.equal((await page.reload()).status(), 200)
      await page.getByRole('button', { name: 'Create my account', exact: true }).waitFor()
      await page.goto(`${base}/travel-dna/new`)
      await page.waitForURL('**/login?next=*')
      await page.goto(`${base}/plan`)
      await page.waitForURL('**/login?next=*')
      await page.goto(`${base}/explore`)
      await page.getByRole('button', { name: 'View itinerary' }).first().waitFor()
      assert.deepEqual(errors, [])
      // A missed chunk during a deployment or interrupted connection must
      // offer recovery, then succeed once the network becomes available.
      await page.route('**/ExplorePage-*.js', route => route.abort())
      await page.reload()
      await page.getByText('This page couldn’t load.', { exact: false }).waitFor()
      await page.unroute('**/ExplorePage-*.js')
      await page.getByRole('button', { name: 'Try again' }).click()
      await page.getByRole('button', { name: 'View itinerary' }).first().waitFor()
      assert.deepEqual(errors, [])
      console.log(`PASS ${configPath}: production assets, 18 direct routes, auth navigation, loading budget, and failed-download recovery`)
    } finally { await context.close(); server.closeAllConnections(); await new Promise(done => server.close(done)) }
  }
} finally { await browser.close() }
