import type { JourneyResponse, QuestJourney } from '../apis/quests'

export function responseCounts(response: JourneyResponse | null | undefined, total: number) {
  const people = [...new Map((response?.people ?? []).map(person => [person.id, person])).values()]
  const okay = Math.min(total, people.filter(person => person.reaction === 'love' || person.reaction === 'works').length)
  const concerns = Math.min(total - okay, people.filter(person => person.reaction === 'concern').length)
  return { okay, concerns, waiting: Math.max(0, total - okay - concerns) }
}

export function groupReadiness(journey: QuestJourney) {
  const total = Math.max(1, journey.totalMembers)
  const preferences = Math.max(0, Math.min(total, journey.memberCount))
  const leading = [...journey.allResults].sort((a, b) => {
    const first = responseCounts(journey.options[a.id], total)
    const second = responseCounts(journey.options[b.id], total)
    return second.okay - first.okay || first.concerns - second.concerns
  })[0]
  const chosen = Boolean(journey.currentPlan)
  const validPlan = chosen && journey.ready && Boolean(journey.planReview?.canConfirm)
  const response = chosen ? journey.planReview : leading ? journey.options[leading.id] : null
  const counts = responseCounts(response, total)
  const agreed = validPlan && journey.planReview?.status === 'agreed' && Boolean(response?.agreed)
  // Four equal milestones; a saved starting point has already passed option consensus.
  // Current-version plan responses are supplied by the API; old votes never count here.
  const progress = [preferences / total, validPlan ? 1 : journey.ready && !chosen ? counts.okay / total : 0, validPlan ? 1 : 0, validPlan ? counts.okay / total : 0]
  const score = Math.min(agreed ? 100 : 99, Math.round(progress.reduce((sum, value) => sum + value, 0) * 25))
  return { total, preferences, leading, chosen, validPlan, response, counts, agreed, progress, score }
}
