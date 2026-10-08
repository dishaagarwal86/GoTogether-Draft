import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

// Read-only UI replay of a local demo plan. Booking flags and missing-date cases
// are changed in response copies only; the saved room and votes remain intact.
const base = process.env.JOURNEY_TEST_URL || 'http://127.0.0.1:5191'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
const out = '.journey-test-results/booking-dates'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, timezoneId: 'America/Los_Angeles', reducedMotion: 'reduce' })
let session, memberSession, memberContext
try {
  const api = async path => { const result = await context.request.get(`${base}/api${path}`, { headers: session ? { Authorization: `Bearer ${session.token}` } : {} }); assert.ok(result.ok(), path); return (await result.json()).data }
  const demo = await api('/demo')
  const login = await context.request.post(`${base}/api/demo/session`, { data: { actorKey: 'aarav' } })
  assert.ok(login.ok()); session = (await login.json()).data
  const room = demo.scenes.find(scene => scene.key === 'ready').roomId
  const original = await api(`/working-plans/${room}`)
  const originalJourney = await api(`/trip-rooms/${room}/journey`)
  assert.deepEqual(original.travelDates, { start: '2027-01-14', end: '2027-01-17' })
  const fixture = structuredClone(original)
  fixture.bookings.flights[0].departDate = ''; fixture.bookings.flights[0].returnDate = ''
  fixture.booked = { flights: fixture.bookings.flights.map(flight => [flight.flightNumber, flight.airline, flight.fromCode, flight.toCode, flight.departDate].join('|')), stays: fixture.bookings.stays.slice(0, 1).map(stay => [stay.name, stay.area].join('|')) }
  fixture.days[0].items[0].booked = true
  await context.addInitScript(session => { localStorage.setItem('gotogether.session-token', session.token); localStorage.setItem('gotogether.current-user-id', session.user.id) }, session)
  const blocked = []
  await context.route('**/api/**', route => {
    if (!['GET', 'HEAD'].includes(route.request().method())) { blocked.push(new URL(route.request().url()).pathname); return route.fulfill({ status: 409, json: { error: 'Read-only UI replay' } }) }
    return route.continue()
  })
  await context.route(`**/api/working-plans/${room}`, route => route.fulfill({ json: { data: fixture } }))
  const page = await context.newPage(); page.setDefaultTimeout(20000)
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${base}/quests/${room}?tab=itinerary`)
  const bookings = page.locator('.canvas-bookings')
  await bookings.locator('.trip-stay').first().waitFor()
  const stayStop = page.locator('.canvas-activity.kind-stay')
  assert.equal(await stayStop.getByRole('button', { name: 'I booked this', exact: true }).count(), 0)
  await stayStop.getByRole('button', { name: 'View shared stay', exact: true }).click()
  assert.equal(await page.locator('[data-stay-options]').evaluate(element => document.activeElement === element), true)
  const flightDates = bookings.locator('.trip-flight .booking-travel-dates').first()
  assert.match(await flightDates.innerText(), /Thu, 14 Jan 2027/)
  assert.match(await flightDates.innerText(), /Sun, 17 Jan 2027/)
  const stay = bookings.locator('.trip-stay').first()
  const stayTabs = bookings.getByRole('tablist', { name: 'Compare stay options' }).getByRole('tab')
  assert.match(await stay.locator('.booking-travel-dates').innerText(), /Check-in\s+Thu, 14 Jan 2027\s+Check-out\s+Sun, 17 Jan 2027/i)
  const url = new URL(await stay.getByRole('link', { name: 'See availability' }).getAttribute('href'))
  assert.equal(url.searchParams.get('checkin'), '2027-01-14'); assert.equal(url.searchParams.get('checkout'), '2027-01-17')
  const summary = page.locator('.booked-itinerary')
  assert.equal(await summary.locator('.booking-travel-dates').count(), 5)
  assert.equal(await summary.locator('article').count(), 6)
  assert.equal(await stay.getByRole('button', { name: 'Unmark booking' }).isEnabled(), true)
  assert.equal(await bookings.locator('.trip-stay').count(), 1, 'Only the viewed alternative is a full card')
  await stayTabs.nth(1).click()
  assert.match(await stay.locator('h4').innerText(), /Sukhumvit/)
  assert.equal(await stay.getByRole('button', { name: 'Mark this stay as booked' }).count(), 0)
  assert.match(await stay.locator('.stay-alternative-note').innerText(), /Silom.*already marked/)
  await stayTabs.nth(0).click()
  assert.match(await summary.innerText(), /Thu, 14 Jan 2027 · 10:00/)
  await summary.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${out}/booked-summary-desktop.png` })
  await page.getByRole('navigation', { name: 'Itinerary days', exact: true }).getByRole('button', { name: /DAY 03/ }).click()
  assert.match(await page.locator('.canvas-day-heading').innerText(), /Sat, 16 Jan 2027/)
  await bookings.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${out}/booking-cards-desktop.png` })
  for (const width of [900, 390, 320]) {
    await page.setViewportSize({ width, height: 950 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No overflow at ${width}`)
  }
  await stay.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${out}/stay-mobile.png` })
  await page.goto(`${base}/itineraries`)
  const library = page.locator('.itinerary-library-card').filter({ hasText: 'Bangkok · Everyone is on board' })
  await library.waitFor(); assert.match(await library.innerText(), /14 Jan 2027 – 17 Jan 2027/)
  await page.goto(`${base}/quests/${room}?tab=options`)
  await page.locator('.group-day-heading .booking-day-date').first().waitFor()
  assert.match(await page.locator('.group-day-heading .booking-day-date').first().innerText(), /Thu, 14 Jan 2027/)
  // The same date display must handle flexible, partial and shorter-stay cases.
  delete fixture.travelDates; delete fixture.bookings.travel_dates
  fixture.bookings.flights.forEach(flight => { flight.departDate = ''; flight.returnDate = '' })
  fixture.bookings.flights[0].returnDate = '2027-01-17'
  await page.goto(`${base}/quests/${room}?tab=itinerary`)
  await flightDates.waitFor()
  assert.match(await flightDates.innerText(), /Depart\s+Date to confirm\s+Return\s+Sun, 17 Jan 2027/i)
  assert.match(await stay.locator('.booking-travel-dates').innerText(), /Check-in\s+Date to confirm\s+Check-out\s+Date to confirm/i)
  assert.ok(!(await stay.getByRole('link', { name: 'See availability' }).getAttribute('href')).includes('checkin='))
  // Legacy overlaps are visible and reversible; separate nights remain bookable.
  fixture.booked.stays = fixture.bookings.stays.map(stay => [stay.name, stay.area].join('|'))
  await page.reload(); await stay.waitFor()
  assert.match(await summary.locator('.stay-booking-conflict').innerText(), /overlapping or unconfirmed dates/)
  for (const tab of await stayTabs.all()) { await tab.click(); assert.equal(await stay.getByRole('button', { name: 'Unmark booking', exact: true }).isEnabled(), true) }
  fixture.booked.stays = fixture.booked.stays.slice(0, 1)
  fixture.bookings.stays[0] = { ...fixture.bookings.stays[0], nights: 2, checkIn: '2027-01-14', checkOut: '2027-01-16' }
  fixture.bookings.stays[1] = { ...fixture.bookings.stays[1], nights: 1, checkIn: '2027-01-16', checkOut: '2027-01-17' }
  fixture.bookings.stays.push(structuredClone(fixture.bookings.stays[0]))
  await page.reload(); await stay.waitFor()
  assert.equal(await stayTabs.count(), 2, 'Repeated suggestion appears once')
  assert.equal(await bookings.locator('.trip-stay').count(), 1)
  await stayTabs.nth(1).click()
  assert.equal(await stay.getByRole('button', { name: 'Mark this stay as booked', exact: true }).isEnabled(), true)
  assert.equal(await summary.locator('.stay-booking-conflict').count(), 0)
  fixture.travelDates = original.travelDates; fixture.bookings.stays[0].nights = 2
  delete fixture.bookings.stays[0].checkIn; delete fixture.bookings.stays[0].checkOut
  await page.reload(); await stay.waitFor()
  assert.match(await stay.locator('.booking-travel-dates').innerText(), /Date to confirm/)
  assert.ok(!(await stay.getByRole('link', { name: 'See availability' }).getAttribute('href')).includes('checkin='))
  const oldStayStop = fixture.days[0].items.find(item => item.kind === 'stay')
  assert.ok(oldStayStop); oldStayStop.booked = true
  await page.reload(); await stay.waitFor()
  await page.getByRole('navigation', { name: 'Itinerary days', exact: true }).getByRole('button', { name: /DAY 01/ }).click()
  assert.equal(await stayStop.getByRole('button', { name: 'Unmark separate booking', exact: true }).isEnabled(), true)
  assert.equal(await stayStop.getByRole('button', { name: 'I booked this', exact: true }).count(), 0)
  // The screenshot came from a crew account. Verify real member permissions,
  // option switching and responsive layouts against the unchanged native plan.
  memberContext = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' })
  const memberLogin = await memberContext.request.post(`${base}/api/demo/session`, { data: { actorKey: 'meera' } })
  assert.ok(memberLogin.ok()); memberSession = (await memberLogin.json()).data
  await memberContext.addInitScript(session => { localStorage.setItem('gotogether.session-token', session.token); localStorage.setItem('gotogether.current-user-id', session.user.id) }, memberSession)
  await memberContext.route('**/api/**', route => {
    if (!['GET', 'HEAD'].includes(route.request().method())) { blocked.push(new URL(route.request().url()).pathname); return route.fulfill({ status: 409, json: { error: 'Read-only UI replay' } }) }
    return route.continue()
  })
  const memberPage = await memberContext.newPage()
  memberPage.on('pageerror', error => errors.push(error.message))
  await memberPage.goto(`${base}/quests/${room}?tab=itinerary`)
  const memberChoices = memberPage.locator('.canvas-bookings .stay-choice-panel')
  await memberChoices.waitFor()
  assert.match(await memberChoices.locator('.stay-choice-status').innerText(), /Host manages bookings/)
  assert.equal(await memberPage.locator('.canvas-bookings .booking-mark, .canvas-bookings .booking-confirmed').count(), 0)
  const memberTabs = memberChoices.getByRole('tab')
  if (original.booked?.stays.length === 1) {
    assert.match(await memberTabs.nth(0).innerText(), /SELECTED STAY/)
    assert.match(await memberTabs.nth(1).innerText(), /OTHER STAY OPTION/)
    assert.match(await memberChoices.locator('.trip-stay .stay-choice-label').innerText(), /Selected stay/)
    await memberChoices.screenshot({ path: `${out}/demo-selected-stay.png` })
  }
  await memberTabs.nth(0).focus(); await memberPage.keyboard.press('ArrowRight')
  assert.equal(await memberTabs.nth(1).getAttribute('aria-selected'), 'true')
  assert.match(await memberChoices.locator('.trip-stay h4').innerText(), /Sukhumvit/)
  assert.match(await memberChoices.getByRole('link', { name: 'See availability' }).getAttribute('href'), /Sukhumvit/)
  await memberChoices.screenshot({ path: `${out}/stay-choice-member-desktop.png` })
  for (const width of [1120, 900, 390, 320]) {
    await memberPage.setViewportSize({ width, height: 950 })
    await memberTabs.nth(0).click(); await memberTabs.nth(1).click()
    assert.ok(await memberPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Member choices fit at ${width}`)
  }
  await memberChoices.screenshot({ path: `${out}/stay-choice-member-mobile.png` })
  assert.deepEqual(errors, []); assert.deepEqual(blocked, [])
  assert.deepEqual(await api(`/working-plans/${room}`), original)
  assert.equal((await api(`/trip-rooms/${room}/journey`)).planReview.version, originalJourney.planReview.version)
  const checks = ['Flight fallback dates and partial return date', 'Hotel check-in/out and matching Booking.com search parameters', 'Booked flights, stays and activity dates', 'Calendar dates on itinerary days and previews', 'My itineraries dates', 'Flexible dates and shorter stays remain explicit', 'Desktop and mobile layouts', 'Saved demo, revision and agreement unchanged', 'Overlapping hotel alternatives blocked and old overlaps reversible', 'Separate split stays enabled and duplicate options removed', 'Check-in stop navigates to shared stay and permits clearing old separate flags', 'One visible stay with keyboard accessible alternative tabs', 'Real crew account sees host-managed status without disabled booking buttons']
  await writeFile(`${out}/result.json`, JSON.stringify({ checks }, null, 2))
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2))
} finally {
  if (memberSession) await memberContext.request.post(`${base}/api/auth/logout`, { headers: { Authorization: `Bearer ${memberSession.token}` } })
  if (session) await context.request.post(`${base}/api/auth/logout`, { headers: { Authorization: `Bearer ${session.token}` } })
  await browser.close()
}
