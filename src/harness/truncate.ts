// Big tool output would fill the model's context. Cut it and say so, so the model
// knows to narrow its request instead of assuming it saw everything.
export const MAX_BYTES = 30_000

export interface Truncated {
  text: string
  truncated: boolean
  note?: string
}

export function truncateHead(text: string, maxBytes = MAX_BYTES): Truncated {
  if (Buffer.byteLength(text) <= maxBytes) return { text, truncated: false }
  const kept = Buffer.from(text).subarray(0, maxBytes).toString('utf8')
  const cut = kept.lastIndexOf('\n')
  const body = cut > 0 ? kept.slice(0, cut) : kept
  return {
    text: body,
    truncated: true,
    note: `Output cut at ${maxBytes} bytes. Narrow the path, pattern, or line range to see the rest.`,
  }
}
