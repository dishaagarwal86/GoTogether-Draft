import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { confirmRoomPreferences, chooseSoloPlan } from './journey-actions.mjs'

const base = process.env.JOURNEY_TEST_URL ?? 'http://127.0.0.1:5186'
const apiBase = process.env.JOURNEY_TEST_API_URL ?? base
assert.equal(new URL(base).hostname, '127.0.0.1')
assert.equal(new URL(apiBase).hostname, '127.0.0.1')
const out = '.journey-test-results/solo-flow'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const checks = [], errors = []
const check = name => { checks.push(name); console.log('PASS ' + name) }
const api = async (path, token, body) => {
  const response = await fetch(`${apiBase}/api${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const result = await response.json(); assert.ok(response.ok, `${path}: ${JSON.stringify(result)}`); return result.data
}
const password = 'Synthetic solo flow 2026!'
const account = name => api('/auth/signup', null, { firstName: name, lastName: 'Traveller', email: `${name.toLowerCase()}-solo-${Date.now()}@example.invalid`, password })
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } })
const page = await context.newPage(); page.setDefaultTimeout(18000); page.on('pageerror', error => errors.push(error.message))
const section = label => page.getByRole('navigation', { name: 'Room sections' }).getByRole('button', { name: label, exact: true })
const shot = async name => {
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo({ top: 0, behavior: 'instant' }); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) })
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true, animations: 'disabled' })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${name}: horizontal overflow`)
}
try {
  const host = await account('Avery'), friend = await account('Mira')
  await context.addInitScript(value => { localStorage.setItem('gotogether.session-token', value.token); localStorage.setItem('gotogether.current-user-id', value.user.id) }, host)
  await page.goto(`${base}/travel-dna/new`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Just me', exact: true }).click()
  await page.getByRole('button', { name: 'Start my solo trip', exact: true }).waitFor()
  assert.equal(await page.getByLabel('Kind of trip').inputValue(), 'solo')
  assert.equal(await page.getByLabel('Travellers, including you', { exact: true }).count(), 0)
  await shot('01-solo-start')
  await page.getByRole('button', { name: 'With others', exact: true }).click()
  assert.equal(await page.getByLabel('Travellers, including you', { exact: true }).inputValue(), '2')
  await page.getByLabel('Kind of trip').selectOption('solo')
  assert.equal(await page.getByRole('button', { name: 'Just me', exact: true }).getAttribute('aria-pressed'), 'true')
  await page.getByRole('button', { name: 'With others', exact: true }).click()
  await page.getByLabel('Your trip idea').fill('Four days in Kyoto, food and local culture, with time to wander.')
  await page.getByRole('button', { name: 'Create our room', exact: true }).click()
  await page.waitForURL('**/quests/room_*?tab=crew')
  const original = new URL(page.url()).pathname.split('/').at(-1)
  check('Solo is a visible choice; context, count and primary action stay consistent')

  await page.getByRole('button', { name: 'Just me', exact: true }).click()
  await page.getByRole('region', { name: 'Solo planning room', exact: true }).waitFor()
  assert.equal(new URL(page.url()).pathname, `/quests/${original}`)
  await shot('02-converted-in-place')
  await confirmRoomPreferences(page)
  assert.equal(await page.getByRole('button', { name: 'Works for me', exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Make this my plan', exact: true }).isEnabled(), true)
  await shot('03-solo-options')
  await chooseSoloPlan(page)
  await page.getByRole('button', { name: 'Mark this version ready', exact: true }).click()
  await page.getByRole('heading', { name: 'Ready when you are.', exact: true }).waitFor()
  await page.locator('.canvas-activity').first().getByRole('button', { name: 'Edit / replace', exact: true }).click()
  await page.getByLabel('What shall we do?').fill('My unhurried breakfast by the river')
  await page.getByRole('button', { name: 'Save this moment', exact: true }).click()
  await page.getByRole('heading', { name: 'My unhurried breakfast by the river', exact: true }).waitFor()
  await page.locator('.canvas-activity').first().getByRole('button', { name: /^Lock / }).click()
  await page.locator('.canvas-activity').first().getByRole('button', { name: /^Unlock / }).waitFor()
  const saved = await api(`/working-plans/${original}`, host.token)
  assert.equal(saved.days[0].items[0].locked, true)
  check('An empty group converts in place; solo planning needs no self-vote and supports review and edits')

  await page.getByRole('button', { name: 'With others', exact: true }).click()
  await page.getByRole('region', { name: 'Group planning room', exact: true }).waitFor()
  assert.equal((await api(`/trip-rooms/${original}/journey`, host.token)).ready, false)
  assert.deepEqual((await api(`/working-plans/${original}`, host.token)).days, saved.days)
  const link = await api(`/trip-rooms/${original}/join-link`, host.token, {})
  await api(`/join-room/${link.url.split('/').at(-1)}`, friend.token, {})
  await api(`/users/${friend.user.id}/preferences`, friend.token, { tripRoomId: original, submitted: true, dates: { flexible: true }, daysCount: 4, budget: 'Flexible', moodPreferences: ['Food & Culture'], pace: 'A balanced mix' })
  await api(`/trip-rooms/${original}/messages`, friend.token, { body: 'The shared trip stays with us.' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByText('2 of 2 ready · Updates automatically', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Just me', exact: true }).click()
  await page.getByRole('region', { name: 'Create a solo copy', exact: true }).waitFor()
  await shot('04-copy-explained')
  await page.getByRole('button', { name: 'Stay with the crew', exact: true }).click()
  assert.equal(new URL(page.url()).pathname, `/quests/${original}`)
  check('Switching back preserves edits and unlocks invitations; a joined room explains the solo copy before continuing')

  await page.getByRole('button', { name: 'Just me', exact: true }).click()
  let committed
  await page.route(`**/trip-rooms/${original}/travel-mode`, async route => { const response = await route.fetch(); committed = (await response.json()).data; await route.abort('failed') }, { times: 1 })
  await page.getByRole('button', { name: 'Create my solo copy', exact: true }).click()
  await page.locator('.room-travel-mode').getByRole('alert').waitFor()
  assert.ok(committed?.copied)
  await page.getByRole('button', { name: 'Create my solo copy', exact: true }).click()
  await page.waitForURL(`**/quests/${committed.roomId}?tab=itinerary`)
  await page.getByRole('heading', { name: 'My unhurried breakfast by the river', exact: true }).waitFor()
  const copied = await api(`/working-plans/${committed.roomId}`, host.token)
  assert.deepEqual(copied.days, saved.days); assert.equal(copied.canUndo, false)
  const rooms = await api(`/users/${host.user.id}/trip-rooms`, host.token)
  assert.equal(rooms.length, 2, 'A lost response and retry must not create duplicate solo trips')
  assert.equal((await api(`/trip-rooms/${original}/journey`, friend.token)).totalMembers, 2)
  await shot('05-solo-itinerary-desktop')
  check('A lost response retries the same copy; the edited plan and locks survive and the shared room remains accessible')

  await page.setViewportSize({ width: 390, height: 844 })
  await shot('06-solo-itinerary-mobile')
  await section('Your trip').click()
  await shot('07-solo-overview-mobile')
  await section('Trip notes').click()
  await page.getByRole('heading', { name: 'Your trip notebook.', exact: true }).waitFor()
  assert.equal(await page.getByText('The shared trip stays with us.', { exact: true }).count(), 0)
  await page.getByLabel('Add a trip note', { exact: true }).fill('Leave room for a book and a long lunch.')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await page.getByText('Leave room for a book and a long lunch.', { exact: true }).waitFor()
  await shot('08-solo-notes-mobile')
  await section('Saved ideas').click()
  await page.getByRole('heading', { name: 'My little book of possibilities.', exact: true }).waitFor()
  assert.equal(await page.getByText('SHARED SHORTLIST', { exact: true }).count(), 0)
  check('Mobile solo navigation, notes and saved ideas work without group voting or horizontal overflow')
  assert.deepEqual(errors, [])
  await writeFile(`${out}/result.json`, JSON.stringify({ checks, preview: { email: host.user.email, password, roomId: committed.roomId, sharedRoomId: original }, errors }, null, 2))
  console.log(`${checks.length} solo journey checks passed.`)
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {})
  throw error
} finally { await browser.close() }
