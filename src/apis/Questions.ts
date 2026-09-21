export function updateAnswer(answers: Record<string, string>, id: string, value: string) {
  return { ...answers, [id]: value }
}
