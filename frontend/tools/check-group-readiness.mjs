import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

// Read-only replay. Optional saved itinerary JSON can reproduce a reported room.
const base = process.env.JOURNEY_TEST_URL || 'http://127.0.0.1:5191'
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname))
const fixture = JSON.parse(await readFile('.journey-test-results/solo-flow/result.json', 'utf8')).preview
const roomId = 'group-readiness-review'
const template = {country:'Thailand',duration_days:2,budget:'Moderate',estimated_cost_usd:470,currency:'USD',seasons:[],moods:[],location_type:'City',short_description:'Explore at your own pace.',matchedPreferences:[],compromises:[],source:'ai',label:'Your best match'}
const day = (title, activities) => ({title,...Object.fromEntries(['morning','afternoon','evening'].map((slot,i)=>[slot,activities[i]])),moments:Object.fromEntries(['morning','afternoon','evening'].map((slot,i)=>[slot,{activity:activities[i],imageQuery:activities[i],detail:'Explore this stop at your own pace.'}]))})
const stay = (name,area) => ({name,area,type:'Stay idea',nights:2,totalPrice:60,pricePerNight:30})
const flight = {from:'Mumbai',fromCode:'BOM',to:'Bangkok',toCode:'BKK',airline:'',departDate:'',returnDate:'',pricePerPerson:200}
const trips = process.env.PHOTO_REVIEW_ITINERARIES ? JSON.parse(await readFile(process.env.PHOTO_REVIEW_ITINERARIES,'utf8')) : [
 {...template,id:'review-bangkok',destination:'Bangkok',title:'Bangkok days',daily_plan:[day('Riverside discovery',['Grand Palace','Wat Arun','Yaowarat Night Market']),day('A different side of Bangkok',['Chatuchak Weekend Market','Safari World','Sky Bar'])],stays:[stay('Silom stay','Silom'),stay('Sukhumvit stay','Sukhumvit')],flights:[flight]},
 {...template,id:'review-rayong',destination:'Rayong',title:'Rayong days',daily_plan:[day('Coast and culture',['Mae Ramphueng Beach','Wat Pa Pradu','Rayong Night Market']),day('Beyond the city',['U-Tapao Airport','Khao Kheow Open Zoo','Khao Kheow Forest Park Trail'])],stays:[stay('City stay','Rayong City Centre'),stay('Beach stay','Rayong Seaside')]},
 {...template,id:'review-trang',destination:'Trang',title:'Trang days',daily_plan:[day('Explore Trang',['Trang City Walking Tour','Hat Chao Mai National Park','Trang Night Market']),day('Coastal discoveries',['Emerald Cave','Pak Meng Beach','Seafood Dinner at Pak Meng Beach'])],stays:[stay('Town stay','Old Town Trang'),stay('Coastal stay','Pak Meng Beach')]},
]
const out='.journey-test-results/group-readiness'
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
 await context.route('**/api/users/*/trip-rooms',route=>route.fulfill({json:{data:[{id:roomId,name:'Thailand photo review',tripName:'Thailand',members:4,role:'owner',createdAt:new Date().toISOString(),inviteStatus:'joined'}]}}))
 const names=['You','Aisha','Ravi','Sam']
 const participants=names.map((name,i)=>({id:i?`person-${i}`:session.user.id,name,role:i?'member':'owner',status:i<2?'ready':'joined'}))
 const response=reactions=>({people:participants.map((p,i)=>({...p,isMe:i===0,reaction:reactions[i],note:reactions[i]==='concern'?'I would prefer a slower afternoon.':''})),answered:reactions.filter(Boolean).length,concerns:reactions.filter(x=>x==='concern').length,agreed:reactions.every(x=>x==='love'||x==='works')})
 const journey={ready:false,totalMembers:4,memberCount:2,participants,results:[],allResults:[],travelDna:{sharedVibe:[],budgetStyle:'Moderate',noGoActivities:[],groupSize:4},blockers:[],preferenceVersion:'crew-v1',generationStatus:'ready',generationPending:false,currentPlan:null,planReview:null,availability:{start:null,end:null,days:null,conflict:false},questReadiness:{totalMembers:4,completedMembers:2,readinessState:'gathering',options:[],mainTension:null,explanation:'Gathering'},options:{}}
 await context.route(`**/api/trip-rooms/${roomId}/journey`,route=>route.fulfill({json:{data:journey}}))
 let votes=0
 await context.route(`**/api/trip-rooms/${roomId}/responses`,route=>{const body=route.request().postDataJSON();assert.equal(body.kind,'option');assert.equal(body.version,journey.preferenceVersion);journey.options[body.optionId]=response([body.reaction,'works','concern',null]);votes++;return route.fulfill({json:{data:{ok:true}}})})
 await context.route(`**/api/working-plans/${roomId}`,route=>route.fulfill({json:{data:null}}))
 await context.route('**/api/personalise-itinerary?**',route=>route.fulfill({json:{data:null}}))
 await context.route('**/api/companion/history?**',route=>route.fulfill({json:{data:[]}}))
 await context.route('**/api/companion',route=>route.fulfill({json:{id:'explanation',source:'ollama',summary:'This suggestion balances your shared interests and pace.'}}))
 await context.route('https://commons.wikimedia.org/**',route=>route.fulfill({status:429,headers:{'Retry-After':'60'},body:'Provider unavailable'}))
 const rateRequests=[]
 await context.route('https://api.frankfurter.dev/**',route=>{const base=new URL(route.request().url()).pathname.split('/').at(-2);rateRequests.push(base);return route.fulfill({json:{base,quote:'INR',rate:base==='USD'?100:3,date:new Date().toISOString().slice(0,10)}})})
 const page=await context.newPage();page.setDefaultTimeout(15000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 const card=page.getByRole('region',{name:'Quest readiness',exact:true})
 const refresh=()=>page.evaluate(()=>window.dispatchEvent(new CustomEvent('gotogether:preferences-updated')))
 const expectScore=score=>page.waitForFunction(score=>document.querySelector('[aria-label="Quest planning readiness"]')?.getAttribute('aria-valuenow')===String(score),score)
 await page.goto(`${base}/quests/${roomId}?tab=crew`);await card.waitFor();await expectScore(13)
 assert.match(await card.innerText(),/2 of 4 ready/);assert.match(await card.innerText(),/4\s+Yet to respond/)
 await card.locator('.readiness-people summary').click();assert.match(await card.innerText(),/Sam/)
 journey.ready=true;journey.memberCount=4;participants.forEach(p=>p.status='ready');journey.results=trips;journey.allResults=trips;journey.options=Object.fromEntries(trips.map(t=>[t.id,response([null,'works','concern',null])]))
 await refresh();await expectScore(31)
 await card.getByRole('button',{name:'Compare group options',exact:true}).click()
 await page.locator('.group-reaction-buttons').getByRole('button',{name:'Love it',exact:true}).click();await expectScore(38)
 assert.equal(votes,1);assert.match(await card.innerText(),/2\s+Okay with it/);assert.match(await card.innerText(),/1\s+Have concerns/);assert.match(await card.innerText(),/1\s+Yet to respond/)
 assert.match(await page.locator('.group-decision-tally').innerText(),/2 okay with it/)
 for(const width of [1440,900,390,320]) {
  await page.setViewportSize({width,height:1100});await card.evaluate(el=>window.scrollTo({top:el.getBoundingClientRect().top+scrollY-155,behavior:'instant'}))
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`Readiness card fits ${width}px`)
  await page.screenshot({path:`${out}/readiness-${width}.png`})
 }
 const trip=trips[0]
 journey.options[trip.id]=response(['works','love','works','works']);await refresh();await expectScore(50)
 await card.getByRole('button',{name:'View planning steps and responses',exact:true}).click()
 await card.getByRole('button',{name:'Choose an agreed option',exact:true}).waitFor()
 await card.getByRole('button',{name:'Hide planning steps',exact:true}).click()
 journey.currentPlan={catalogueId:trip.id,title:trip.title,destination:trip.destination,country:trip.country,days:[]}
 const planReview=reactions=>({...response(reactions),version:'plan-v2',revision:2,preferencesChanged:false,canConfirm:true,status:reactions.every(x=>x==='love'||x==='works')?'agreed':'review'})
 journey.planReview=planReview(['works','works','concern',null]);await refresh();await expectScore(88)
 assert.match(await card.innerText(),/SAVED PLAN RESPONSES/)
 journey.planReview=planReview(['works','works','love','works']);await refresh();await expectScore(100)
 await card.getByRole('heading',{name:'Everyone is on board.',exact:true}).waitFor()
 journey.planReview={...planReview([null,null,null,null]),revision:3,version:'plan-v3'};await refresh();await expectScore(75)
 journey.planReview={...journey.planReview,canConfirm:false,preferencesChanged:true};await refresh();await expectScore(25)
 await card.getByRole('button',{name:'View planning steps and responses',exact:true}).click()
 assert.match(await card.innerText(),/Preferences changed/)
 await card.locator('.readiness-method summary').click();assert.match(await card.innerText(),/Missing responses and concerns never count as agreement/)
 assert.deepEqual(errors,[]);assert.deepEqual(unexpectedWrites,[])
 await writeFile(`${out}/result.json`,JSON.stringify({states:7,widths:[1440,900,390,320],mockedVotes:votes,errors,unexpectedWrites},null,2))
 console.log('PASS four-person readiness: preferences, concerns, waiting, live response updates, host selection, current-plan agreement, revision reset and mobile layout')
} finally {await browser.close()}
