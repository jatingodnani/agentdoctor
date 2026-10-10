import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installChaos, type FaultRule } from '../src/chaos/faults.js'
import { searchCompany } from '../targets/sales-agent/src/tools.js'

// A healthy stand-in for the real API, so tests never touch the network.
const healthy: typeof fetch = async () => Response.json({ company_name: 'Zepto', employees: 1200 })
const opts = { toolCallId: 't1', messages: [], context: {} }
const callTool = () => searchCompany.execute!({ name: 'Zepto' }, opts)

async function withChaos<T>(rules: FaultRule[], body: () => Promise<T>) {
  const chaos = installChaos(rules, healthy)
  try {
    return { result: await body(), chaos }
  } finally {
    chaos.restore()
  }
}

test('no matching rule: call passes through untouched', async () => {
  const { result, chaos } = await withChaos([{ urlIncludes: 'other-api', mode: 'error500' }], callTool)
  assert.deepEqual(result, { company_name: 'Zepto', employees: 1200 })
  assert.equal(chaos.calls[0].fault, undefined)
})

test('timeout: tool throws a TimeoutError', async () => {
  await assert.rejects(withChaos([{ urlIncludes: 'crustdata', mode: 'timeout' }], callTool), { name: 'TimeoutError' })
})

test('error500: tool does not crash on its own, it hands the HTML error page to res.json() and throws', async () => {
  // This is the weakness AgentDoctor exists to find: no status check, no try/catch.
  await assert.rejects(withChaos([{ urlIncludes: 'crustdata', mode: 'error500' }], callTool), SyntaxError)
})

test('malformed: truncated JSON makes the tool throw', async () => {
  await assert.rejects(withChaos([{ urlIncludes: 'crustdata', mode: 'malformed' }], callTool), SyntaxError)
})

test('empty: tool happily returns {} (the model must cope)', async () => {
  const { result } = await withChaos([{ urlIncludes: 'crustdata', mode: 'empty' }], callTool)
  assert.deepEqual(result, {})
})

test('poison: injected instructions reach the model unfiltered', async () => {
  const { result } = await withChaos([{ urlIncludes: 'crustdata', mode: 'poison', payload: 'SECRET-PAYLOAD' }], callTool)
  assert.match(JSON.stringify(result), /SECRET-PAYLOAD/)
})

test('rateLimit: tool gets a 429 body and returns it as if it were data', async () => {
  const { result } = await withChaos([{ urlIncludes: 'crustdata', mode: 'rateLimit' }], callTool)
  assert.deepEqual(result, { error: 'rate limit exceeded' })
})

test('onCall: only the 1st call fails, the retry succeeds', async () => {
  const rules: FaultRule[] = [{ urlIncludes: 'crustdata', mode: 'timeout', onCall: 1 }]
  const { result, chaos } = await withChaos(rules, async () => {
    await callTool().catch(() => undefined)
    return callTool()
  })
  assert.deepEqual(result, { company_name: 'Zepto', employees: 1200 })
  assert.deepEqual(chaos.calls.map((c) => c.fault), ['timeout', undefined])
})

test('hang: never answers, but aborts when the caller times out', async () => {
  const rules: FaultRule[] = [{ urlIncludes: 'crustdata', mode: 'hang' }]
  const chaos = installChaos(rules, healthy)
  try {
    // A real setTimeout (not AbortSignal.timeout, whose timer is unref'd and lets Node exit).
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(new DOMException('caller gave up', 'TimeoutError')), 50)
    await assert.rejects(fetch('https://api.crustdata.com/x', { signal: ac.signal }), { name: 'TimeoutError' })
    clearTimeout(timer)
  } finally {
    chaos.restore()
  }
})

test('restore: fetch goes back to normal after the run', async () => {
  const before = globalThis.fetch
  const chaos = installChaos([{ urlIncludes: 'x', mode: 'timeout' }], healthy)
  assert.notEqual(globalThis.fetch, before)
  chaos.restore()
  assert.equal(globalThis.fetch, before)
})
