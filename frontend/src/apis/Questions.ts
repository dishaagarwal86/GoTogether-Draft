import type { AnswerValue } from '../data/Questions'

export function updateAnswer(answers: Record<string, AnswerValue>, id: string, value: AnswerValue) {
  return { ...answers, [id]: value }
}
