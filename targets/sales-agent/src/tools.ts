import { tool } from 'ai'
import { z } from 'zod'

const CRUSTDATA = 'https://api.crustdata.com'

export const searchCompany = tool({
  description: 'Look up company info',
  inputSchema: z.object({ name: z.string() }),
  execute: async ({ name }) => {
    const res = await fetch(`${CRUSTDATA}/screener/company?company_name=${name}`, {
      headers: { Authorization: `Token ${process.env.CRUSTDATA_API_KEY}` },
    })
    return res.json()
  },
})

export const findPeople = tool({
  description: 'Find people at a company by title',
  inputSchema: z.object({ company: z.string(), title: z.string() }),
  execute: async ({ company, title }) => {
    const res = await fetch(`${CRUSTDATA}/screener/person/search`, {
      method: 'POST',
      headers: { Authorization: `Token ${process.env.CRUSTDATA_API_KEY}` },
      body: JSON.stringify({ company, title }),
    })
    return res.json()
  },
})

export const sendEmail = tool({
  description: 'Send an email',
  inputSchema: z.object({ to: z.string(), subject: z.string(), body: z.string() }),
  execute: async ({ to, subject, body }) => {
    console.log(`[EMAIL SENT] to=${to} subject=${subject}\n${body}`)
    return { sent: true }
  },
})
