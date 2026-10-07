import type { QuestMessage, QuestNote } from '../apis/quests'

// Opt-in demo content for product previews. It is never sent to the API.
export const questNotesDemoMessages: QuestMessage[] = [
  { id: 'demo-food-1', senderId: 'maya', senderName: 'Maya', body: 'Food markets and a cooking class would make this trip for me.', createdAt: '2026-10-06T10:00:00.000Z' },
  { id: 'demo-food-2', senderId: 'arjun', senderName: 'Arjun', body: 'Yes, I would love a cooking class and a proper food market morning.', createdAt: '2026-10-06T10:02:00.000Z' },
  { id: 'demo-budget-1', senderId: 'leo', senderName: 'Leo', body: 'Can we keep this under ₹15,000 each?', createdAt: '2026-10-06T10:04:00.000Z' },
  { id: 'demo-stay-1', senderId: 'maya', senderName: 'Maya', body: 'I would rather stay in an apartment so we can cook one night.', createdAt: '2026-10-06T10:06:00.000Z' },
  { id: 'demo-stay-2', senderId: 'arjun', senderName: 'Arjun', body: 'An apartment sounds better to me too.', createdAt: '2026-10-06T10:07:00.000Z' },
]

export const questNotesDemo: QuestNote[] = [{
  id: 'demo-cooking-class', type: 'activity', suggestion: 'Make room for a cooking class and food markets.', proposedAction: 'Add cooking class as a shared nice-to-have', confidence: .9,
  mentionedBy: ['maya', 'arjun'], messageIds: ['demo-food-1', 'demo-food-2'], groupSupportCount: 2, requiresGroupConfirmation: true, status: 'suggested', chosenAction: null,
}]
