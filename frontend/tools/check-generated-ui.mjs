import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

// Exercise generated cards with controlled responses; no model calls or writes.
const base = process.env.JOURNEY_TEST_URL || 'http://127.0.0.1:5186'
assert.equal(new URL(base).hostname, '127.0.0.1')
const fixture = JSON.parse(await readFile('.journey-test-results/solo-flow/result.json', 'utf8')).preview
const out = '.journey-test-results/generated-ui'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const context = await browser.newContext()
  const sessionResponse = await context.request.post(`${base}/api/auth/login`, { data: { email: fixture.email, password: fixture.password } })
  assert.equal(sessionResponse.ok(), true)
  const session = (await sessionResponse.json()).data
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('gotogether.session-token', token)
    localStorage.setItem('gotogether.current-user-id', user.id)
    sessionStorage.setItem('gotogether.activity-photos.v3', 'null')
  }, session)
  await context.route(`**/api/working-plans/${fixture.roomId}`, async route => {
    const response = await route.fetch()
    const value = await response.json()
    assert.ok(value.data)
    value.data.bookings = { destination: value.data.destination, duration_days: 4, budget: 'Moderate', location_type: 'City', estimated_cost_usd: 850, currency: 'USD', travel_dates: { start: '2027-04-01', end: '2027-04-04' }, flights: [{ from: 'Mumbai', fromCode: 'BOM', to: 'Osaka', toCode: 'KIX', airline: 'UNVERIFIED AIRLINE', flightNumber: 'UNVERIFIED123', departDate: '2027-04-01', returnDate: '2027-04-04', departTime: '09:30', arriveTime: '17:00', stops: 0, duration: '7h 30m', pricePerPerson: 350 }], stays: [{ name: 'Synthetic waterfront stay', area: 'Harbour district', type: 'Guesthouse', stars: 5, reviewScore: 9.9, reviewLabel: 'UNVERIFIED REVIEW', highlights: ['UNVERIFIED CANCELLATION'], pricePerNight: 100, nights: 3, totalPrice: 300, imageQuery: 'Synthetic waterfront stay' }] }
    await route.fulfill({ response, json: value })
  })
  const source = 'https://commons.wikimedia.org/wiki/File:GoTogether_test.jpg'
  const image = 'https://upload.wikimedia.org/wikipedia/commons/test/GoTogether_test.jpg'
  await context.route('https://commons.wikimedia.org/**', route => route.fulfill({ status: 200, json: { query: { pages: { 1: { index: 1, imageinfo: [{ thumburl: image, descriptionurl: source, extmetadata: { Artist: { value: '<b>Synthetic photographer</b>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } } }] } } } } }))
  await context.route('https://upload.wikimedia.org/**', route => route.fulfill({ path: 'src/assets/landing/mountains.jpg', contentType: 'image/jpeg' }))
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${base}/quests/${fixture.roomId}?tab=itinerary`)
  const bookingCards = page.getByRole('region', { name: 'Flights and stays' })
  await bookingCards.waitFor()
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    await bookingCards.scrollIntoViewIfNeeded()
    await page.getByRole('link', { name: /Photo: Synthetic photographer/ }).first().waitFor()
    assert.equal(await bookingCards.getByText(/UNVERIFIED/).count(), 0)
    assert.match(await bookingCards.innerText(), /AI planning estimates, not live quotes/)
    assert.match(await bookingCards.innerText(), /per room per night/)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Generated cards fit ${width}px`)
    const small = await bookingCards.evaluate(root => [...root.querySelectorAll('*')].filter(element => element.checkVisibility() && element.textContent.trim() && !element.closest('svg')).filter(element => parseFloat(getComputedStyle(element).fontSize) < 12).map(element => element.className))
    assert.deepEqual(small, [], `Generated cards have readable text at ${width}px`)
    assert.equal(await page.getByRole('link', { name: /Photo: Synthetic photographer/ }).first().getAttribute('href'), source)
    await page.screenshot({ path: `${out}/bookings-${width}.png` })
    console.log(`PASS Generated flight/stay cards, photo attribution and readable layout at ${width}px`)
  }
  assert.deepEqual(errors, [])
  await writeFile(`${out}/result.json`, JSON.stringify({ checks: 3, errors }, null, 2))
} finally { await browser.close() }
