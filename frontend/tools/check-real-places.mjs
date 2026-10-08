import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.JOURNEY_TEST_URL || 'http://127.0.0.1:5186'
assert.equal(new URL(base).hostname, '127.0.0.1')
assert.equal(process.env.OPENAI_API_KEY || process.env.OLLAMA_API_KEY || '', '', 'This test must not call live AI')
const out = '.journey-test-results/real-places'
await mkdir(out, { recursive: true })
const api = async (path, token, data) => {
  const response = await fetch(`${base}/api${path}`, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: data ? JSON.stringify(data) : undefined })
  assert.ok(response.ok, `${path}: HTTP ${response.status}`)
  return (await response.json()).data
}
const account = await api('/auth/signup', null, { firstName: 'Places', lastName: 'Reviewer', email: `places-${randomUUID()}@example.invalid`, password: 'Synthetic places review 2026!' })
const room = await api('/trip-rooms', account.token, { name: 'Sourced places review', tripName: 'Kyoto', members: 1 })
await api(`/users/${account.user.id}/preferences`, account.token, { submitted: true, tripRoomId: room.id, dates: { flexible: true }, daysCount: 6, pace: 'A balanced mix', budget: 'Moderate', moodPreferences: ['Food & Culture'], locationPreferences: { destination: 'Kyoto', fixed: true }, personalizationEnabled: false })
const journey = await api(`/trip-rooms/${room.id}/journey`, account.token)
assert.equal(journey.generationStatus, 'unconfigured')
await api(`/working-plans/${room.id}`, account.token, { catalogueId: journey.allResults[0].id })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const checks = [], errors = []
const check = name => { checks.push(name); console.log('PASS ' + name) }
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
  await context.addInitScript(({ token, user }) => { localStorage.setItem('gotogether.session-token', token); localStorage.setItem('gotogether.current-user-id', user.id) }, account)
  // Image discovery is covered separately; this test checks real catalogue/API data.
  await context.route('https://commons.wikimedia.org/**', route => route.fulfill({ json: { query: { pages: {} } } }))
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => errors.push(error.message))
  const panelButton = name => page.getByRole('navigation', { name: 'Plan your trip' }).getByRole('button', { name, exact: true })
  await page.goto(`${base}/quests/${room.id}?tab=itinerary`)
  const ideas = page.locator('.canvas-area-ideas')
  await ideas.getByText('Places from official sources.', { exact: false }).waitFor()
  const search = page.getByRole('textbox', { name: 'Search things to do in Kyoto' })
  await search.fill('Nishiki')
  await page.getByRole('button', { name: 'Search ideas', exact: true }).click()
  const official = ideas.getByRole('link', { name: 'Official source for Nishiki Market' })
  await official.waitFor()
  await ideas.getByRole('img', { name: 'Nishiki Market', exact: true }).scrollIntoViewIfNeeded()
  await page.waitForFunction(() => { const img = document.querySelector('.canvas-area-idea img'); return img?.complete && img.naturalWidth > 0 && img.src.endsWith('/photos/places/kyoto-nishiki-market.webp') })
  assert.equal(await official.getAttribute('href'), 'https://www.kyoto-nishiki.or.jp/en/')
  assert.match(await ideas.innerText(), /Place identity checked/)
  await page.screenshot({ path: `${out}/official-ideas.png` })
  check('Real place search works with AI disabled and exposes the official source')
  await ideas.getByRole('button', { name: 'Add Nishiki Market', exact: true }).click()
  await page.getByRole('button', { name: 'Add to this day', exact: true }).click()
  const card = page.locator('.canvas-activity').filter({ has: page.getByRole('heading', { name: 'Nishiki Market', exact: true }) })
  await card.getByRole('link', { name: 'Official source for Nishiki Market' }).waitFor()
  assert.match(await card.locator('img').getAttribute('src'), /kyoto-nishiki-market\.webp$/)
  await page.reload()
  await card.getByRole('link', { name: 'Official source for Nishiki Market' }).waitFor()
  let plan = await api(`/working-plans/${room.id}`, account.token)
  assert.equal(plan.days.flatMap(day => day.items).find(item => item.title === 'Nishiki Market').placeSource.placeId, 'kyoto-nishiki-market')
  check('Adding a real place saves its canonical source and survives reload')
  await card.getByRole('button', { name: 'Edit / replace', exact: true }).click()
  await page.getByLabel('What shall we do?', { exact: true }).fill('A different lunch spot')
  await page.getByRole('button', { name: 'Save this moment', exact: true }).click()
  await page.getByRole('heading', { name: 'A different lunch spot', exact: true }).waitFor()
  plan = await api(`/working-plans/${room.id}`, account.token)
  assert.equal(plan.days.flatMap(day => day.items).find(item => item.title === 'A different lunch spot').placeSource, undefined)
  check('Replacing a sourced place removes the old citation')
  await panelButton('Flights & stays').click()
  const stays = page.getByLabel('Stays from official sources')
  await stays.getByRole('link', { name: 'Official source for Hyatt Regency Kyoto' }).waitFor()
  assert.match(await stays.getByRole('img', { name: 'Hyatt Regency Kyoto', exact: true }).getAttribute('src'), /kyoto-hyatt-regency\.webp$/)
  assert.equal(await stays.getByRole('link', { name: 'Official source for Hyatt Regency Kyoto' }).getAttribute('href'), 'https://www.hyatt.com/hyatt-regency/en-US/kyoto-hyatt-regency-kyoto')
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 })
    await stays.scrollIntoViewIfNeeded()
    await page.waitForFunction(() => { const img = document.querySelector('.sourced-stays img'); return img?.complete && img.naturalWidth > 0 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `No overflow at ${width}px`)
    const small = await stays.evaluate(root => [...root.querySelectorAll('*')].filter(node => node.checkVisibility() && node.textContent.trim()).filter(node => parseFloat(getComputedStyle(node).fontSize) < 12).map(node => node.tagName))
    assert.deepEqual(small, [])
    await page.screenshot({ path: `${out}/stays-${width}.png` })
  }
  check('Matched place photos survive saving; sourced hotel photos load without external search at desktop and mobile sizes')
  assert.deepEqual(errors, [])
  await writeFile(`${out}/result.json`, JSON.stringify({ checks, errors, roomId: room.id }, null, 2))
} finally { await browser.close() }
