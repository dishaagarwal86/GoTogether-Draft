import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

// Run after check-solo-journey in test:journey. Its synthetic account gives us
// real saved group and solo rooms without contacting production services.
const base = process.env.JOURNEY_TEST_URL || 'http://127.0.0.1:5186'
const api = process.env.JOURNEY_TEST_API_URL || base
const fixture = JSON.parse(await readFile('.journey-test-results/solo-flow/result.json', 'utf8')).preview
const out = '.journey-test-results/presentation'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true })
const results = []
try {
  const context = await browser.newContext()
  const response = await context.request.post(`${api}/api/auth/login`, { data: { email: fixture.email, password: fixture.password } })
  assert.equal(response.ok(), true, 'The isolated fixture account can sign in')
  const session = (await response.json()).data
  await context.addInitScript(({ token, user }) => {
    if (!['/login', '/signup'].includes(location.pathname)) {
      localStorage.setItem('gotogether.session-token', token)
      localStorage.setItem('gotogether.current-user-id', user.id)
    } else { localStorage.removeItem('gotogether.session-token'); localStorage.removeItem('gotogether.current-user-id') }
  }, session)
  const page = await context.newPage()
  const errors = []
  const externalFonts = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) externalFonts.push(request.url()) })
  const pages = [
    ['login', '/login'], ['signup', '/signup'], ['dashboard', '/dashboard'], ['quests', '/trips'],
    ['create', '/travel-dna/new'], ['details', '/travel-dna/new?details=1'],
    ['preferences', `/travel-dna/preferences?roomId=${fixture.roomId}`],
    ['explore', '/explore'], ['profile', '/profile'], ['crew', '/crew'], ['travel-style', '/travel-style'],
    ['solo', `/quests/${fixture.roomId}?tab=itinerary`],
    ['group', `/quests/${fixture.sharedRoomId}?tab=crew`],
    ['options', `/quests/${fixture.sharedRoomId}?tab=options`],
    ['chat', `/quests/${fixture.sharedRoomId}?tab=chat`],
    ['member-preferences', `/quests/${fixture.sharedRoomId}?tab=crew&preferences=1`],
  ]
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 })
    for (const [name, path] of pages) {
      await page.goto(base + path)
      await page.locator('main h1').first().waitFor()
      if (path.startsWith('/quests/')) await page.locator('.group-room-toolbar').waitFor()
      if (name === 'solo') await page.locator('.canvas-activity').first().waitFor()
      if (name === 'options') await page.locator('.group-itinerary-detail').waitFor()
      if (name === 'member-preferences') await page.getByRole('region', { name: 'Your trip preferences' }).waitFor()
      await page.evaluate(() => document.fonts.ready)
      const result = await page.evaluate(() => {
        const visible = element => element.checkVisibility() && !element.closest('svg, [aria-hidden="true"]')
        const text = [...document.querySelectorAll('main *, .journey-nav *, .journey-footer *, dialog *')].filter(element => visible(element) && [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()))
        const small = text.filter(element => { const size = parseFloat(getComputedStyle(element).fontSize); return size > 0 && size < 12 }).map(element => ({ text: element.textContent.slice(0, 60), size: getComputedStyle(element).fontSize }))
        const inputs = [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea')].filter(visible).filter(element => parseFloat(getComputedStyle(element).fontSize) < 16).map(element => ({ name: element.getAttribute('aria-label') || element.name, size: getComputedStyle(element).fontSize }))
        const headings = [...document.querySelectorAll('main h1')].filter(visible).map(element => parseFloat(getComputedStyle(element).fontSize))
        return { small, inputs, headings, overflow: document.documentElement.scrollWidth > innerWidth + 1, sansLoaded: document.fonts.check('16px "DM Sans"'), serifLoaded: document.fonts.check('400 32px "Fraunces"') }
      })
      results.push({ name, width, ...result })
      assert.deepEqual(result.small, [], `${name} at ${width}px: readable labels`)
      assert.deepEqual(result.inputs, [], `${name} at ${width}px: readable inputs without mobile focus zoom`)
      assert.equal(result.overflow, false, `${name} at ${width}px: no page overflow`)
      assert.ok(result.headings.every(size => size === (width === 1440 ? 48 : 32)), `${name} at ${width}px: shared page heading scale`)
      assert.ok(result.sansLoaded && result.serifLoaded, `${name}: brand fonts loaded`)
      if (['create', 'solo', 'options', 'member-preferences'].includes(name)) await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true })
    }
    console.log(`PASS Typography, inputs, and layout across ${pages.length} pages at ${width}px`)
  }
  assert.deepEqual(externalFonts, [], 'Fonts load from the application origin')
  assert.deepEqual(errors, [], 'No browser runtime errors')
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify(results, null, 2))
  await browser.close()
}
