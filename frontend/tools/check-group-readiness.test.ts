import assert from 'node:assert/strict'
import { test } from 'node:test'
import { groupReadiness, responseCounts } from '../src/services/groupReadiness.ts'
import type { JourneyResponse, QuestJourney } from '../src/apis/quests.ts'
const response = (reactions: Array<'love' | 'works' | 'concern' | null>): JourneyResponse => ({ people: reactions.map((reaction, i) => ({ id: String(i), name: `Traveller ${i}`, isMe: i === 0, reaction, note: '' })), answered: reactions.filter(Boolean).length, concerns: reactions.filter(x => x === 'concern').length, agreed: reactions.every(x => x === 'love' || x === 'works') })
const fixture = (): QuestJourney => ({ totalMembers: 4, memberCount: 4, ready: true, participants: [], allResults: [{ id: 'a', title: 'Bangkok' }], results: [], options: { a: response(['love', 'works', 'concern', null]) }, currentPlan: null, planReview: null } as unknown as QuestJourney)
const review = (reactions: Array<'love' | 'works' | 'concern' | null>) => {const r = response(reactions);return {...r,version:'current',revision:2,preferencesChanged:false,canConfirm:true,status:r.agreed ? 'agreed' as const : 'review' as const}}
test('expected travellers without a response never count as agreement', () => {
 assert.deepEqual(responseCounts(response(['love','works','concern']),5),{okay:2,concerns:1,waiting:2})
 const data=fixture();data.memberCount=2;data.ready=false;data.options={}
 assert.equal(groupReadiness(data).score,13)
})
test('one shared option drives consensus; votes on different options are never added together', () => {
 const data=fixture();data.allResults.push({...data.allResults[0],id:'b'});data.options.b=response(['works',null,null,null])
 const state=groupReadiness(data)
 assert.equal(state.leading?.id,'a');assert.equal(state.score,38);assert.equal(state.counts.concerns,1)
 data.options.a=response(['works','love','works','works'])
 assert.equal(groupReadiness(data).score,50,'Unanimous option agreement still needs host selection and plan review')
})
test('only current-version plan agreement reaches 100%; edits require new responses', () => {
 const data=fixture();data.currentPlan={catalogueId:'a',title:'Bangkok',destination:'Bangkok',country:'Thailand',days:[]}
 data.planReview=review(['love','works','concern',null]);assert.equal(groupReadiness(data).score,88)
 data.planReview=review(['love','works','works','works']);assert.equal(groupReadiness(data).score,100)
 data.planReview=review([null,null,null,null]);assert.equal(groupReadiness(data).score,75)
 data.planReview={...review(['works','works','works','works']),canConfirm:false,status:'review',preferencesChanged:true}
 assert.equal(groupReadiness(data).score,25,'A plan outside current shared requirements is not ready')
 data.totalMembers=5;data.ready=false;assert.equal(groupReadiness(data).score,20,'Adding a traveller reopens readiness')
})
