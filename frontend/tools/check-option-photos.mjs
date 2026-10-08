import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

// Read-only UI replay: no itinerary regeneration or changes to a traveller's room.
const base = process.env.JOURNEY_TEST_URL || 'http://127.0.0.1:5186'
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname))
const fixture = JSON.parse(await readFile('.journey-test-results/solo-flow/result.json', 'utf8')).preview
const roomId = process.env.PHOTO_REVIEW_ROOM || fixture.roomId
const template = { country: 'Japan', duration_days: 2, budget: 'Moderate', estimated_cost_usd: 800, seasons: [], moods: [], location_type: 'City', short_description: 'A few days to explore Tokyo.', matchedPreferences: [], compromises: [], source: 'ai', label: 'A different perspective' }
const day = (morning, afternoon, evening) => ({ morning, afternoon, evening, moments: Object.fromEntries(Object.entries({morning, afternoon, evening}).map(([slot, activity]) => [slot, {activity, imageQuery: activity, detail: 'Explore at your own pace.'}])) })
const trips = process.env.PHOTO_REVIEW_ITINERARIES ? JSON.parse(await readFile(process.env.PHOTO_REVIEW_ITINERARIES, 'utf8')) : [
  { ...template, id: 'photo-kichijoji', destination: 'Kichijoji, Tokyo', title: 'Kichijoji days', daily_plan: [day('Inokashira Park Boat Ride', 'Dinner at Harmonica Yokocho', 'Ghibli Museum'), day('Jindaiji Temple', 'Todoroki Valley', 'Yanaka Ginza')], stays: [{ name: 'Kichijoji Guesthouse', area: 'Kichijoji', type: 'Stay idea', nights: 2, totalPrice: 200, pricePerNight: 100 }] },
  { ...template, id: 'photo-tokyo', destination: 'Tokyo', title: 'Tokyo neighbourhoods', daily_plan: [day('Shimokitazawa vintage shops', 'Setagaya Park', 'Nezu Shrine'), day('Tsukishima', 'Kagurazaka', 'Sumida River')], stays: [{ name: 'Koenji Guesthouse', area: 'Koenji', type: 'Stay idea', nights: 2, totalPrice: 200, pricePerNight: 100 }] },
]
const out = '.journey-test-results/option-photos'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
 const context = await browser.newContext({ viewport: {width:1440,height:1000} })
 const login = await context.request.post(`${base}/api/auth/login`, {data:{email:fixture.email,password:fixture.password}})
 assert.ok(login.ok(), 'Local fixture login succeeds')
 const session = (await login.json()).data
 await context.addInitScript(({token,user}) => {localStorage.setItem('gotogether.session-token',token);localStorage.setItem('gotogether.current-user-id',user.id)}, session)
 await context.route('**/api/users/*/trip-rooms', route => route.fulfill({json:{data:[{id:roomId,name:'Tokyo photo review',tripName:'Kichijoji, Tokyo',members:1,role:'owner',createdAt:new Date().toISOString(),inviteStatus:'joined'}]}}))
 await context.route(`**/api/trip-rooms/${roomId}/journey`, route => route.fulfill({json:{data:{ready:true,totalMembers:1,memberCount:1,participants:[{id:session.user.id,name:'Traveller',role:'owner',status:'ready'}],results:trips,allResults:trips,travelDna:{sharedVibe:[],budgetStyle:'Moderate',noGoActivities:[],groupSize:1},blockers:[],preferenceVersion:'photos-v1',generationStatus:'ready',generationPending:false,currentPlan:null,planReview:null,availability:{start:null,end:null,days:null,conflict:false},questReadiness:{totalMembers:1,completedMembers:1,readinessState:'unlocked',options:[],mainTension:null,explanation:'Ready'},options:Object.fromEntries(trips.map(t=>[t.id,{people:[],agreed:true,answered:1,concerns:0}]))}}}))
 await context.route(`**/api/working-plans/${roomId}`, route => route.fulfill({json:{data:null}}))
 // An unavailable provider must not leave curated place cards blank.
 await context.route('https://commons.wikimedia.org/**', route => route.fulfill({status:429,headers:{'Retry-After':'60'},body:'Provider unavailable'}))
 await context.route('**/api/companion/**', route => route.fulfill({json:{data:[]}}))
 const page = await context.newPage()
 page.setDefaultTimeout(15000)
 const errors=[]
 page.on('pageerror', e=>errors.push(e.message))
 await page.goto(`${base}/quests/${roomId}?tab=options`)
 await page.locator('.group-option-card').first().waitFor()
 assert.equal(await page.locator('.group-option-card').count(),trips.length)
 const covers = await page.locator('.group-option-photo img').evaluateAll(images=>images.map(img=>img.getAttribute('src')))
 assert.deepEqual(covers.slice(0,2),['/photos/places/tokyo-kichijoji.webp','/photos/places/tokyo-city.webp'])
 assert.equal(await page.locator('button a').count(),0,'Photo credit links are outside buttons')
 for(let i=0;i<trips.length;i++) {
  if(i) await page.getByRole('button',{name:'Next itinerary',exact:true}).click()
  const moments=page.locator('.group-preview-moment')
  assert.ok(await moments.count()>0)
  for(const img of await moments.locator('img').all()) {
   await img.scrollIntoViewIfNeeded()
   await img.evaluate(img=>img.decode())
   assert.match(await img.getAttribute('src'),/^\/photos\/places\//,'Every Tokyo activity has a local exact-place or labelled area photo')
  }
  for(const stay of await page.locator('.trip-stay').all()) {
   await stay.scrollIntoViewIfNeeded()
   await stay.locator('img').evaluate(img=>img.decode())
   assert.match(await stay.innerText(),/Area view ·/,'Unverified stays use labelled neighbourhood photography')
  }
  await page.locator('.group-preview-cover').scrollIntoViewIfNeeded()
  await page.screenshot({path:`${out}/option-${i+1}.png`})
 }
 for(const width of [1440,390,320]) {
  await page.setViewportSize({width,height:1000})
  await page.locator('.group-preview-day').first().scrollIntoViewIfNeeded()
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`No overflow at ${width}px`)
  const tooSmall=await page.locator('.group-preview-days').evaluate(root=>[...root.querySelectorAll('*')].filter(el=>el.checkVisibility()&&el.textContent.trim()&&!el.closest('svg')&&parseFloat(getComputedStyle(el).fontSize)<12).map(el=>el.className))
  assert.deepEqual(tooSmall,[],`Readable photo captions at ${width}px`)
  await page.screenshot({path:`${out}/days-${width}.png`})
 }
 await page.getByRole('group',{name:'Preview itinerary days'}).getByRole('button',{name:'Day 2',exact:true}).click()
 assert.equal(await page.locator('.group-preview-day').count(),1,'Day navigation still works')
 await page.locator('.group-preview-cover').scrollIntoViewIfNeeded()
 assert.equal(await page.getByRole('link',{name:/License|View 4K|Photo:/}).count(),0,'No photo licence or full-size links clutter the cards')
 const catalogue=JSON.parse(await readFile('src/data/placePhotos.json','utf8'))
 const full=catalogue.find(p=>p.placeId==='tokyo-city')
 assert.ok(full.fullWidth>=3840 && full.fullHeight>=2160)
 const response=await context.request.get(new URL(full.fullUrl,base).href)
 assert.ok(response.ok(),'Full-resolution asset is served')
 // A failed responsive variant retries the base image; a failed base gets a fallback.
 const cover=page.locator('.group-preview-cover img')
 for(let retry=0;retry<2;retry++) { await cover.evaluate(img=>img.dispatchEvent(new Event('error'))); await page.waitForTimeout(100) }
 await cover.evaluate(img=>img.decode())
 assert.notEqual(await cover.getAttribute('src'),'/photos/places/tokyo-city.webp')
 await page.getByRole('link', { name: 'Photo credits', exact: true }).click()
 await page.getByRole('heading',{name:'Photo credits',exact:true}).waitFor()
 assert.ok(await page.getByRole('heading',{name:'Inokashira Park',exact:true}).count()>0,'Attribution is available separately')
 await page.goto(`${base}/explore`)
 await page.locator('.explore-card').first().waitFor()
 const showAll=page.getByRole('button',{name:/^Show all .* itineraries$/})
 if(await showAll.count()) await showAll.click()
 const explorePhotos=page.locator('.explore-card-image img')
 const sources=await explorePhotos.evaluateAll(images=>new Set(images.map(img=>img.getAttribute('src'))).size)
 assert.ok(sources>=10,'The full collection includes all built-in destination covers')
 for(const img of await explorePhotos.all()) {
  await img.scrollIntoViewIfNeeded()
  await img.evaluate(img=>img.decode())
  assert.match(await img.getAttribute('src'),/^\/photos\/places\//,'Explore covers do not depend on external search')
 }
 await page.locator('.explore-card').first().getByRole('button',{name:/View itinerary/}).click()
 await page.locator('.drawer-image img').evaluate(img=>img.decode())
 assert.match(await page.locator('.drawer-image img').getAttribute('src'),/^\/photos\/places\//)
 assert.deepEqual(errors,[])
 const result={checks:6,options:trips.length,providerOffline:true,widths:[1440,390,320],errors}
 await writeFile(`${out}/result.json`,JSON.stringify(result,null,2))
 console.log('PASS Tokyo/Kichijoji covers, daily place photos, labelled stays, mobile layout, full-size images and failure recovery')
} finally { await browser.close() }
