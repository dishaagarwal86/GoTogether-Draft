import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'

const base = process.env.JOURNEY_TEST_URL ?? 'http://127.0.0.1:5186'
const apiBase = process.env.JOURNEY_TEST_API_URL ?? base
assert.equal(new URL(base).hostname, '127.0.0.1')
assert.equal(new URL(apiBase).hostname, '127.0.0.1')
const out = '.journey-test-results/motion'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const contexts = [], checks = [], errors = []
const check = name => { checks.push(name); console.log('PASS ' + name) }
const api = async (path, token, body) => {
  const response = await fetch(`${apiBase}/api${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const value = await response.json()
  assert.ok(response.ok, `${path}: ${JSON.stringify(value)}`)
  return value.data
}
const section = (page, name) => page.getByRole('navigation', { name: 'Room sections' }).getByRole('button', { name, exact: true })
const settle = page => page.waitForFunction(() => !document.documentElement.dataset.questMotion)
const shot = async (page, name) => {
  await settle(page)
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true, animations: 'disabled' })
  await page.screenshot({ path: `${out}/${name}-viewport.png`, animations: 'disabled' })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${name}: horizontal overflow`)
}
async function contextFor(account, fallback = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } })
  contexts.push(context)
  await context.addInitScript(({ account, fallback }) => {
    if (account) { localStorage.setItem('gotogether.session-token', account.token); localStorage.setItem('gotogether.current-user-id', account.user.id) }
    sessionStorage.setItem('gotogether.activity-photos.v3', 'null')
    window.motionChecks = { started: 0, completed: 0, failures: [] }
    const animate = Element.prototype.animate
    if (fallback) { Element.prototype.animate = undefined; return }
    if (animate) Element.prototype.animate = function (...args) {
      window.motionChecks.started++
      if (document.documentElement.dataset.questMotion === 'room') {
          const expected = { crew: 'Your trip', options: 'Compare options', itinerary: 'My itinerary', ideas: 'Saved ideas', chat: 'Trip notes' }[new URL(location.href).searchParams.get('tab')]
          const label = document.querySelector('[aria-label="Room sections"] [aria-pressed="true"]')?.textContent
          if (expected && !label?.startsWith(expected)) window.motionChecks.failures.push(`Animating ${label} while navigating to ${expected}`)
      }
      const animation = animate.apply(this, args)
      animation.finished.then(() => window.motionChecks.completed++, error => {
        if (error.name !== 'AbortError') window.motionChecks.failures.push(`${error.name}: ${error.message}`)
      })
      return animation
    }
  }, { account, fallback })
  await context.route('https://commons.wikimedia.org/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"query":{"pages":{}}}' }))
  const page = await context.newPage()
  page.setDefaultTimeout(18000)
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error' && /Cannot update a component|Maximum update depth/.test(message.text())) errors.push(message.text())
  })
  return page
}
try {
  const account = await api('/auth/signup', null, { firstName: 'Motion', lastName: 'Traveller', email: `motion-${Date.now()}@example.invalid`, password: 'Synthetic motion check 2026!' })
  const page = await contextFor(account)
  await page.route('**/api/companion', route => route.fulfill({ json: { id: 'synthetic-guide', summary: 'A comfortable pace.', source: 'fallback', extracted: { daysCount: 5 } } }))
  await page.goto(`${base}/travel-dna/new`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Just me', exact: true }).click()
  await page.getByLabel('Quest name', { exact: true }).fill('Four days to wander')
  const starter = page.getByRole('region', { name: 'Your trip preferences' })
  await page.getByLabel('Tell the guide about your trip').fill('I would like five days away.')
  await page.getByRole('button', { name: 'Add to my preferences', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.member-preferences select')?.value === '5')
  await starter.getByLabel('How long feels right?').selectOption('4')
  await starter.getByRole('button', { name: 'Continue', exact: true }).click()
  await starter.getByRole('button', { name: 'Food & local culture', exact: true }).click()
  await starter.getByRole('button', { name: /A balanced mix/ }).click()
  await starter.getByRole('button', { name: 'Continue', exact: true }).click()
  await starter.getByLabel('Must-have', { exact: true }).fill('Time to wander')
  await starter.getByRole('button', { name: 'My preferences are ready', exact: true }).click()
  await page.waitForURL('**/quests/room_*?tab=crew')
  const roomId = new URL(page.url()).pathname.split('/').at(-1)
  await page.getByRole('button', { name: 'Review my preferences', exact: true }).click()
  const form = page.getByRole('region', { name: 'Your trip preferences' })
  assert.equal(await form.getByLabel('How long feels right?').inputValue(), '4', 'Manual correction of a guide response survives saving and reopening')
  await form.getByRole('button', { name: 'Continue', exact: true }).click()
  const food = form.getByRole('button', { name: 'Food & local culture', exact: true })
  if (await food.getAttribute('aria-pressed') !== 'true') await food.click()
  await form.getByRole('button', { name: /A balanced mix/ }).click()
  await section(page, 'Trip notes').click()
  // The label is part of the existing chat API; use the composer across both placements.
  const composer = page.locator('.group-room-chat textarea')
  await composer.fill('Keep a long lunch open on day two.')
  await section(page, 'Your trip').click()
  assert.equal(await form.getByRole('button', { name: 'Food & local culture', exact: true }).getAttribute('aria-pressed'), 'true')
  assert.equal(await form.getByRole('heading', { name: 'Your kind of good day.', exact: true }).count(), 1)
  await form.getByRole('button', { name: 'Continue', exact: true }).click()
  await form.getByRole('button', { name: 'My preferences are ready', exact: true }).click()
  await page.getByRole('button', { name: 'Explore my options', exact: true }).click()
  check('Changing room sections preserves the preference step, selections and unsent note')

  await page.getByRole('button', { name: /^All matching itineraries/ }).click()
  await settle(page)
  const cards = page.locator('.group-option-card')
  assert.ok(await cards.count() > 3)
  const card = cards.nth(3)
  const selectedId = await card.getAttribute('data-itinerary-id')
  await card.scrollIntoViewIfNeeded()
  const before = await page.locator('.group-option-grid').evaluate(el => el.scrollTop)
  await card.click()
  await page.getByRole('button', { name: 'Back to options', exact: true }).waitFor()
  await settle(page)
  assert.equal(await page.locator('.group-option-grid').isVisible(), false)
  assert.equal(await page.locator('.group-preview-title').evaluate(el => el === document.activeElement), true)
  await shot(page, '01-focused-destination')
  await page.getByRole('button', { name: 'Back to options', exact: true }).click()
  await settle(page)
  assert.equal(await card.evaluate(el => el === document.activeElement), true)
  assert.ok(Math.abs(await page.locator('.group-option-grid').evaluate(el => el.scrollTop) - before) < 2)
  assert.equal(await api(`/working-plans/${roomId}`, account.token), null)
  check('Card expansion and return preserve keyboard focus, list position and the unsaved plan')

  await card.click()
  await page.getByRole('button', { name: 'Next itinerary', exact: true }).click()
  await settle(page)
  assert.equal(await page.getByRole('button', { name: 'Next itinerary', exact: true }).evaluate(el => el === document.activeElement), true)
  assert.notEqual(await page.locator('.group-option-card.is-selected').getAttribute('data-itinerary-id'), selectedId)
  await page.getByRole('button', { name: 'Previous itinerary', exact: true }).click()
  await page.getByRole('button', { name: 'Day 2', exact: true }).click()
  await section(page, 'Your trip').click()
  await section(page, 'Compare options').click()
  await settle(page)
  assert.equal(await page.locator('.group-option-card.is-selected').getAttribute('data-itinerary-id'), selectedId)
  assert.equal(await page.getByRole('button', { name: 'Day 2', exact: true }).getAttribute('aria-pressed'), 'true')
  assert.equal(await page.locator('.group-preview-day').count(), 1)
  check('Previous and next previews retain the selected option and day across room navigation')

  // Interrupt transitions deliberately: the last clicked section must win.
  await page.evaluate(() => {
    for (const text of ['Trip notes', 'Your trip', 'Compare options']) {
      const button = [...document.querySelectorAll('[aria-label="Room sections"] button')].find(el => el.textContent === text)
      button.click()
    }
  })
  await settle(page)
  assert.equal(new URL(page.url()).searchParams.get('tab'), 'options')
  assert.equal(await section(page, 'Compare options').getAttribute('aria-pressed'), 'true')
  check('Rapid navigation applies the final selection without stale transitions')
  await section(page, 'Your trip').click()
  await settle(page)
  await page.goBack()
  await page.waitForFunction(() => document.querySelector('[aria-label="Room sections"] [aria-pressed="true"]')?.textContent === 'Compare options')
  assert.equal(await page.getByRole('button', { name: 'Day 2', exact: true }).getAttribute('aria-pressed'), 'true')
  check('Browser Back restores the room section and its selected itinerary day')

  await page.getByRole('button', { name: 'Make this my plan', exact: true }).click()
  await page.getByRole('region', { name: 'Trip workspace', exact: true }).waitFor()
  await settle(page)
  await page.getByRole('navigation', { name: 'Workspace tools' }).getByRole('button', { name: 'Notes', exact: true }).click()
  const canvasComposer = page.locator('.canvas-crew-body textarea')
  assert.equal(await canvasComposer.inputValue(), 'Keep a long lunch open on day two.')
  await canvasComposer.fill('Draft changed beside the itinerary.')
  await section(page, 'Trip notes').click()
  assert.equal(await composer.inputValue(), 'Draft changed beside the itinerary.')
  await section(page, 'My itinerary').click()
  await page.getByRole('button', { name: /DAY 02/ }).click()
  await page.locator('.canvas-activity').first().getByRole('button', { name: 'Edit / replace', exact: true }).click()
  await page.getByLabel('What shall we do?', { exact: true }).fill('An unfinished edit to keep')
  await section(page, 'Compare options').click()
  await section(page, 'My itinerary').click()
  assert.equal(await page.getByLabel('What shall we do?', { exact: true }).inputValue(), 'An unfinished edit to keep')
  assert.equal(await page.getByRole('button', { name: /DAY 02/ }).getAttribute('aria-pressed'), 'true')
  await page.locator('.canvas-item-editor').getByRole('button', { name: 'Cancel', exact: true }).click()
  check('Chat drafts follow both chat placements; an unfinished activity edit and day survive navigation')

  await page.setViewportSize({ width: 390, height: 844 })
  const dock = page.getByRole('navigation', { name: 'Workspace tools' })
  await dock.getByRole('button', { name: 'Notes', exact: true }).click()
  await page.getByRole('dialog', { name: 'Planning tools', exact: true }).waitFor()
  assert.equal(await canvasComposer.inputValue(), 'Draft changed beside the itinerary.')
  await page.keyboard.press('Escape')
  await settle(page)
  assert.equal(await page.getByRole('dialog', { name: 'Planning tools', exact: true }).count(), 0)
  assert.equal(await dock.getByRole('button', { name: 'Notes', exact: true }).evaluate(el => el === document.activeElement), true)
  assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
  await shot(page, '02-mobile-itinerary')
  await section(page, 'Compare options').click()
  await shot(page, '03-mobile-preview')
  check('Mobile panels retain drafts, close with Escape, restore focus and release page scrolling')

  const motion = await page.evaluate(() => window.motionChecks)
  assert.ok(motion.started > 5, 'Navigation should animate the live interface')
  assert.ok(motion.completed > 0, 'Uninterrupted animations should finish')
  assert.deepEqual(motion.failures, [], 'No stale scenes or failed animations')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const count = await page.evaluate(() => window.motionChecks.started)
  await page.getByRole('button', { name: 'Full itinerary', exact: true }).click()
  await section(page, 'My itinerary').click()
  await page.getByRole('button', { name: /DAY 01/ }).click()
  await dock.getByRole('button', { name: 'Notes', exact: true }).click()
  assert.equal(await page.evaluate(() => window.motionChecks.started), count)
  assert.equal(await page.locator('.canvas-panel').evaluate(el => getComputedStyle(el).animationName), 'none')
  await page.keyboard.press('Escape')
  check('Reduced motion skips animations and retains all navigation and chat controls')

  const fallback = await contextFor(null, true)
  await fallback.goto(`${base}/workspace-preview`, { waitUntil: 'domcontentloaded' })
  await fallback.getByRole('button', { name: /DAY 02/ }).click()
  await fallback.getByRole('article', { name: 'A little green, a little quiet', exact: true }).waitFor()
  await fallback.getByRole('navigation', { name: 'Workspace tools' }).getByRole('button', { name: 'Companion', exact: true }).click()
  await fallback.locator('.canvas-companion-body').getByRole('heading', { name: 'A little help, right here.', exact: true }).waitFor()
  assert.equal(await fallback.evaluate(() => document.documentElement.dataset.questMotion), undefined)
  check('Browsers without Web Animations can switch days and use planning tools')
  assert.deepEqual(errors, [])
  await writeFile(`${out}/result.json`, JSON.stringify({ checks, errors, motion, roomId }, null, 2))
  console.log(`Verified ${checks.length} motion and continuity checks. Screenshots: ${out}`)
} catch (error) {
  for (const [index, context] of contexts.entries()) await context.pages()[0]?.screenshot({ path: `${out}/failure-${index}.png`, fullPage: true }).catch(() => {})
  throw error
} finally { for (const context of contexts) await context.close(); await browser.close() }
