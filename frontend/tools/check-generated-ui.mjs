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
    if (!sessionStorage.getItem('gotogether.activity-photos.v7')) sessionStorage.setItem('gotogether.activity-photos.v7', 'null')
  }, session)
  // Keep this review independent of the fixture account's live AI/history state.
  const trip = { id: 'booking-review-catalogue', destination: 'Tokyo', country: 'Japan', title: 'Tokyo days', duration_days: 2, budget: 'Moderate', estimated_cost_usd: 800, seasons: [], moods: [], location_type: 'City', short_description: 'A catalogue starting point.', matchedPreferences: [], compromises: [], label: 'Best for you', daily_plan: [{ title: 'Explore Tokyo', morning: 'Inokashira Park', afternoon: 'Ghibli Museum', evening: 'Harmonica Yokocho' }] }
  let journey = { ready: true, totalMembers: 1, memberCount: 1, participants: [{ id: session.user.id, name: 'Traveller', role: 'owner', status: 'ready' }], results: [trip], allResults: [trip], travelDna: { sharedVibe: [], budgetStyle: 'Moderate', noGoActivities: [], groupSize: 1 }, blockers: [], preferenceVersion: 'booking-review', generationStatus: 'unconfigured', generationPending: false, currentPlan: null, planReview: null, availability: { start: null, end: null, days: null, conflict: false }, questReadiness: { totalMembers: 1, completedMembers: 1, readinessState: 'unlocked', options: [], mainTension: null, explanation: 'Ready' }, options: { [trip.id]: { people: [], agreed: true, answered: 1, concerns: 0 } } }
  await context.route(`**/api/trip-rooms/${fixture.roomId}/journey`, route => route.fulfill({ json: { data: journey } }))
  await context.route('**/api/personalise-itinerary?**', route => route.fulfill({ json: { data: null } }))
  await context.route('**/api/companion/history?**', route => route.fulfill({ json: { data: [] } }))
  await context.route(`**/api/working-plans/${fixture.roomId}`, async route => {
    const response = await route.fetch()
    const value = await response.json()
    assert.ok(value.data)
    value.data.bookings = { destination: 'Genoa', duration_days: 4, budget: 'Moderate', location_type: 'City', estimated_cost_usd: 850, currency: 'USD', travel_dates: { start: '2027-04-01', end: '2027-04-04' }, flights: [{ from: 'Mumbai', fromCode: 'BOM', to: 'Osaka', toCode: 'KIX', airline: 'UNVERIFIED AIRLINE', flightNumber: 'UNVERIFIED123', departDate: '2027-04-01', returnDate: '2027-04-04', departTime: '09:30', arriveTime: '17:00', stops: 0, duration: '7h 30m', pricePerPerson: 350 }], stays: [{ name: 'Synthetic waterfront stay', area: 'Harbour district', type: 'Guesthouse', stars: 5, reviewScore: 9.9, reviewLabel: 'UNVERIFIED REVIEW', highlights: ['UNVERIFIED CANCELLATION'], pricePerNight: 100, nights: 3, totalPrice: 300, imageQuery: 'Synthetic waterfront stay' }] }
    await route.fulfill({ response, json: value })
  })
  const source = 'https://commons.wikimedia.org/wiki/File:GoTogether_test.jpg'
  const image = 'https://thumb.wikimedia.org/wikipedia/commons/test/GoTogether_test.jpg'
  const rejected = []
  await context.route('https://commons.wikimedia.org/**', route => {
    const query = new URL(route.request().url()).searchParams.get('gsrsearch').split(' filetype:')[0]
    const result = (index, suffix, description) => ({ index, title: `File:${query} ${description}.jpg`, imageinfo: [{ thumburl: image.replace('GoTogether_test', suffix), descriptionurl: source, mime: 'image/jpeg', mediatype: 'BITMAP', width: 1200, height: 800, extmetadata: { ImageDescription: { value: `${query} ${description}` }, Artist: { value: '<b>Synthetic photographer</b>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } } }] })
    return route.fulfill({ status: 200, json: { query: { pages: { 1: result(1, 'newspaper', 'newspaper scan'), 2: result(2, 'specimen', 'scientific figure specimen'), 3: result(3, 'broken', 'photograph'), 4: result(4, 'GoTogether_test', 'photograph') } } } })
  })
  await context.route('https://thumb.wikimedia.org/**', route => {
    if (/newspaper|specimen/.test(route.request().url())) rejected.push(route.request().url())
    return route.request().url().includes('broken') ? route.fulfill({ status: 404, body: 'Missing image' }) : route.fulfill({ path: 'src/assets/landing/kyoto.jpg', contentType: 'image/jpeg' })
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${base}/quests/${fixture.roomId}?tab=itinerary`)
  await page.getByRole('navigation', { name: 'Plan your trip' }).getByRole('button', { name: 'Flights & stays', exact: true }).click()
  const bookingCards = page.getByRole('region', { name: 'Flights and stays' })
  await bookingCards.waitFor()
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    await bookingCards.scrollIntoViewIfNeeded()
    await page.waitForFunction(() => document.querySelector('.trip-stay > img')?.src.includes('thumb.wikimedia.org'))
    assert.equal(await bookingCards.getByText(/UNVERIFIED/).count(), 0)
    assert.match(await bookingCards.innerText(), /AI planning estimates, not live quotes/)
    assert.match(await bookingCards.innerText(), /per room per night/)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Generated cards fit ${width}px`)
    const small = await bookingCards.evaluate(root => [...root.querySelectorAll('*')].filter(element => element.checkVisibility() && element.textContent.trim() && !element.closest('svg')).filter(element => parseFloat(getComputedStyle(element).fontSize) < 12).map(element => element.className))
    assert.deepEqual(small, [], `Generated cards have readable text at ${width}px`)
    assert.equal(await bookingCards.getByRole('link', { name: /Photo:|License|View 4K/ }).count(), 0)
    await page.screenshot({ path: `${out}/bookings-${width}.png` })
    console.log(`PASS Generated flight/stay cards, photos and readable layout at ${width}px`)
  }
  assert.deepEqual(rejected, [], 'Newspaper and specimen results must never load')
  await page.locator('.trip-stay > img').evaluate(image => image.dispatchEvent(new Event('error')))
  await page.waitForFunction(() => !document.querySelector('.trip-stay .travel-photo-credit'))
  assert.equal(await page.locator('.trip-stay > img').evaluate(image => image.complete && image.naturalWidth > 0), true)
  await page.getByRole('navigation', { name: 'Room sections' }).getByRole('button', { name: 'Compare options', exact: true }).click()
  await page.getByRole('button', { name: /^AI planned/ }).click()
  await page.getByText('No AI plans currently match this trip. Open Recommended to continue with the catalogue.', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Recommended', exact: true }).click()
  await page.locator('.preview-bookings').scrollIntoViewIfNeeded()
  const catalogueBookings = page.getByRole('region', { name: 'Flights and stays' })
  assert.equal(await catalogueBookings.getByRole('link', { name: 'Check flights' }).getAttribute('href'), 'https://www.booking.com/flights/index.html')
  assert.match(await catalogueBookings.getByRole('link', { name: 'Find places to stay' }).getAttribute('href'), /^https:\/\/www.booking.com\/searchresults.html/)
  journey = { ...journey, allResults: [], results: [], generationStatus: 'unconfigured', generationPending: false }
  await page.waitForURL('**?tab=options')
  await page.reload()
  await page.getByText('AI itinerary planning is currently unavailable', { exact: true }).waitFor()
  console.log('PASS AI availability, empty results, catalogue booking links, and image failure recovery')
  await page.getByRole('link', { name: 'Photo credits', exact: true }).click()
  await page.getByRole('heading', { name: 'Photo credits', exact: true }).waitFor()
  assert.equal(await page.locator(`a[href="${source}"]`).count(), 1, 'Remote photo attribution is available on the credits page')
  assert.deepEqual(errors, [])
  await writeFile(`${out}/result.json`, JSON.stringify({ checks: 4, errors }, null, 2))
} finally { await browser.close() }
