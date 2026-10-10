import { generateText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { searchCompany, findPeople, sendEmail } from './tools.js'

const nebius = createOpenAICompatible({
  name: 'nebius',
  baseURL: 'https://api.tokenfactory.nebius.com/v1',
  apiKey: process.env.NEBIUS_API_KEY,
})

export async function run(request: string) {
  const result = await generateText({
    model: nebius(process.env.NEBIUS_MODEL ?? 'moonshotai/Kimi-K2.5'),
    system: 'You are a sales research assistant. Research the company and write an outreach email.',
    prompt: request,
    tools: { searchCompany, findPeople, sendEmail },
  })
  return result.text
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2).join(' ')).then(console.log)
}
