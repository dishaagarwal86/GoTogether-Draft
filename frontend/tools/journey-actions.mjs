// Shared browser actions use the same preference and agreement UI as a traveller.
export async function confirmRoomPreferences(page, days = '4') {
  await page.getByRole('button', { name: 'Share my travel style', exact: true }).click()
  const form = page.getByRole('region', { name: 'Your trip preferences' })
  await form.getByLabel('My dates are flexible').check()
  await form.getByLabel('How long feels right?').selectOption(days)
  await form.getByRole('button', { name: 'Continue', exact: true }).click()
  const mood = form.getByRole('button', { name: 'Food & local culture', exact: true })
  if (await mood.getAttribute('aria-pressed') !== 'true') await mood.click()
  await form.getByRole('button', { name: /A balanced mix/ }).click()
  await form.getByRole('button', { name: 'Continue', exact: true }).click()
  await form.getByRole('button', { name: 'My preferences are ready', exact: true }).click()
  await page.getByRole('button', { name: /^(Compare group options|Explore my options)$/ }).click()
}

export async function chooseSoloPlan(page) {
  await page.getByRole('button', { name: 'Make this my plan', exact: true }).click()
  await page.getByRole('region', { name: 'Trip workspace', exact: true }).waitFor()
  return new URL(page.url()).pathname.split('/').at(-1)
}
