import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

// Read-only replay. Optional saved itinerary JSON can reproduce a reported room.
const base = process.env.JOURNEY_TEST_URL || 'http://127.0.0.1:5191'
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname))
const fixture = JSON.parse(await readFile('.journey-test-results/solo-flow/result.json', 'utf8')).preview
const roomId = 'itinerary-preview-review'
const template = {country:'Thailand',duration_days:2,budget:'Moderate',estimated_cost_usd:470,currency:'USD',seasons:[],moods:[],location_type:'City',short_description:'Explore at your own pace.',matchedPreferences:[],compromises:[],source:'ai',label:'Your best match'}
const day = (title, activities) => ({title,...Object.fromEntries(['morning','afternoon','evening'].map((slot,i)=>[slot,activities[i]])),moments:Object.fromEntries(['morning','afternoon','evening'].map((slot,i)=>[slot,{activity:activities[i],imageQuery:activities[i],detail:'Explore this stop at your own pace.'}]))})
const stay = (name,area) => ({name,area,type:'Stay idea',nights:2,totalPrice:60,pricePerNight:30})
const flight = {from:'Mumbai',fromCode:'BOM',to:'Bangkok',toCode:'BKK',airline:'',departDate:'',returnDate:'',pricePerPerson:200}
const trips = process.env.PHOTO_REVIEW_ITINERARIES ? JSON.parse(await readFile(process.env.PHOTO_REVIEW_ITINERARIES,'utf8')) : [
 {...template,id:'review-bangkok',destination:'Bangkok',title:'Bangkok days',daily_plan:[day('Riverside discovery',['Grand Palace','Wat Arun','Yaowarat Night Market']),day('A different side of Bangkok',['Chatuchak Weekend Market','Safari World','Sky Bar'])],stays:[stay('Silom stay','Silom'),stay('Sukhumvit stay','Sukhumvit')],flights:[flight]},
 {...template,id:'review-rayong',destination:'Rayong',title:'Rayong days',daily_plan:[day('Coast and culture',['Mae Ramphueng Beach','Wat Pa Pradu','Rayong Night Market']),day('Beyond the city',['U-Tapao Airport','Khao Kheow Open Zoo','Khao Kheow Forest Park Trail'])],stays:[stay('City stay','Rayong City Centre'),stay('Beach stay','Rayong Seaside')]},
 {...template,id:'review-trang',destination:'Trang',title:'Trang days',daily_plan:[day('Explore Trang',['Trang City Walking Tour','Hat Chao Mai National Park','Trang Night Market']),day('Coastal discoveries',['Emerald Cave','Pak Meng Beach','Seafood Dinner at Pak Meng Beach'])],stays:[stay('Town stay','Old Town Trang'),stay('Coastal stay','Pak Meng Beach')]},
]
const out='.journey-test-results/itinerary-preview'
await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true})
try {
 const context=await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce'})
 const login=await context.request.post(`${base}/api/auth/login`,{data:{email:fixture.email,password:fixture.password}})
 assert.ok(login.ok(),'Local fixture login succeeds')
 const session=(await login.json()).data
 await context.addInitScript(({token,user})=>{localStorage.setItem('gotogether.session-token',token);localStorage.setItem('gotogether.current-user-id',user.id)},session)
 const unexpectedWrites=[]
 await context.route('**/api/**',route=>{
  if(!['GET','HEAD'].includes(route.request().method())) {unexpectedWrites.push(route.request().url());return route.fulfill({status:409,json:{error:'Read-only review'}})}
  return route.continue()
 })
 await context.route('**/api/users/*/trip-rooms',route=>route.fulfill({json:{data:[{id:roomId,name:'Thailand photo review',tripName:'Thailand',members:1,role:'owner',createdAt:new Date().toISOString(),inviteStatus:'joined'}]}}))
 await context.route(`**/api/trip-rooms/${roomId}/journey`,route=>route.fulfill({json:{data:{ready:true,totalMembers:1,memberCount:1,participants:[{id:session.user.id,name:'Traveller',role:'owner',status:'ready'}],results:trips,allResults:trips,travelDna:{sharedVibe:[],budgetStyle:'Moderate',noGoActivities:[],groupSize:1},blockers:[],preferenceVersion:'preview-v1',generationStatus:'ready',generationPending:false,currentPlan:null,planReview:null,availability:{start:null,end:null,days:null,conflict:false},questReadiness:{totalMembers:1,completedMembers:1,readinessState:'unlocked',options:[],mainTension:null,explanation:'Ready'},options:Object.fromEntries(trips.map(t=>[t.id,{people:[],agreed:true,answered:1,concerns:0}]))}}}))
 await context.route(`**/api/working-plans/${roomId}`,route=>route.fulfill({json:{data:null}}))
 await context.route('**/api/personalise-itinerary?**',route=>route.fulfill({json:{data:null}}))
 await context.route('**/api/companion/history?**',route=>route.fulfill({json:{data:[]}}))
 await context.route('**/api/companion',route=>route.fulfill({json:{id:'explanation',source:'ollama',summary:'This suggestion balances your shared interests and pace.'}}))
 await context.route('https://commons.wikimedia.org/**',route=>route.fulfill({status:429,headers:{'Retry-After':'60'},body:'Provider unavailable'}))
 const rateRequests=[]
 await context.route('https://api.frankfurter.dev/**',route=>{const base=new URL(route.request().url()).pathname.split('/').at(-2);rateRequests.push(base);return route.fulfill({json:{base,quote:'INR',rate:base==='USD'?100:3,date:new Date().toISOString().slice(0,10)}})})
 const page=await context.newPage();page.setDefaultTimeout(15000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(`${base}/quests/${roomId}?tab=options`)
 await page.locator('.group-option-card').first().waitFor()
 assert.equal(await page.locator('.group-option-card').count(),trips.length)
 const covers=await page.locator('.group-option-photo img').evaluateAll(imgs=>imgs.map(img=>img.getAttribute('src')))
 assert.equal(new Set(covers).size,trips.length,'Each destination has its own cover')
 let activityCount=0,stayCount=0
 const inr=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n)
 for(let i=0;i<trips.length;i++) {
  if(i)await page.getByRole('button',{name:'Next itinerary',exact:true}).click()
  const trip=trips[i]
  await page.waitForFunction(expected=>document.querySelector('.group-estimate strong')?.textContent===expected,inr(trip.estimated_cost_usd*100))
  assert.equal(await page.locator('.group-day-heading h3').first().textContent(),trip.daily_plan[0].title)
  const images=page.locator('.group-preview-moment img')
  const sources=[]
  for(const img of await images.all()) {await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode());const src=await img.getAttribute('src');assert.match(src,/^\/photos\/places\//);sources.push(src);activityCount++}
  assert.ok(new Set(sources).size===sources.length,`${trip.destination} has distinct activity photographs`)
  for(const stay of await page.locator('.trip-stay').all()) {await stay.scrollIntoViewIfNeeded();await stay.locator('img').evaluate(i=>i.decode());assert.match(await stay.innerText(),/Area view ·/);stayCount++}
  const booking=page.locator('.trip-bookings')
  assert.doesNotMatch(await booking.innerText(),/\$\d/)
  if(trip.stays?.length)assert.equal(await page.locator('.trip-stay-price strong').first().textContent(),inr(trip.stays[0].totalPrice*100))
  if(trip.flights?.length)assert.equal(await page.locator('.trip-flight footer strong').first().textContent(),inr(trip.flights[0].pricePerPerson*100))
  await page.locator('.group-preview-day').first().scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/day-${i+1}.png`})
  await page.locator('.trip-stays').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/stays-${i+1}.png`})
 }
 await page.getByRole('button',{name:'Explain this match',exact:true}).click()
 await page.locator('.itinerary-ai-explanation').getByText('AI suggestion',{exact:true}).waitFor()
 assert.doesNotMatch(await page.locator('.itinerary-ai-explanation').innerText(),/ollama|openai/i)
 for(const width of [1440,900,390,320]) {
  await page.setViewportSize({width,height:1050})
  for(const selector of ['.group-preview-day','.trip-stays']) {
   await page.locator(selector).first().evaluate(el=>window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-160,behavior:'instant'}))
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`No horizontal overflow at ${width}px`)
   await page.screenshot({path:`${out}/${selector.slice(1)}-${width}.png`})
  }
 }
 await page.getByRole('group',{name:'Preview itinerary days'}).getByRole('button',{name:'Day 2',exact:true}).click()
 assert.equal(await page.locator('.group-preview-day').count(),1)
 await page.getByRole('group',{name:'Preview itinerary days'}).getByRole('button',{name:'Full itinerary',exact:true}).click()
 assert.equal(await page.locator('.group-preview-day').count(),trips.at(-1).daily_plan.length)
 assert.equal(rateRequests.filter(x=>x==='USD').length,1,'One shared rate request serves all cards')
 // Flight/stay currencies can differ from the canonical USD trip total.
 const selected=trips.at(-1)
 selected.currency='THB'
 await page.reload()
 await page.waitForFunction(expected=>document.querySelector('.trip-stay-price strong')?.textContent===expected,inr(selected.stays[0].totalPrice*3))
 assert.equal(await page.locator('.group-estimate strong').textContent(),inr(selected.estimated_cost_usd*100))
 selected.currency='INR'
 await page.reload()
 await page.waitForFunction(expected=>document.querySelector('.trip-stay-price strong')?.textContent===expected,inr(selected.stays[0].totalPrice))
 selected.currency='ZZZ'
 await context.route('https://api.frankfurter.dev/v2/rate/ZZZ/INR',route=>route.fulfill({status:503,body:'Unavailable'}))
 await page.reload()
 await page.waitForFunction(()=>document.querySelector('.trip-stay-price strong')?.textContent==='INR estimate unavailable')
 assert.deepEqual(unexpectedWrites,[],'Review does not mutate a room or call live AI')
 assert.deepEqual(errors,[])
 await writeFile(`${out}/result.json`,JSON.stringify({options:trips.length,activityCount,stayCount,widths:[1440,900,390,320],errors,unexpectedWrites},null,2))
 console.log(`PASS ${trips.length} itineraries, ${activityCount} activity photos, ${stayCount} stay photos, INR conversion, AI label, navigation and four responsive widths`)
} finally {await browser.close()}
