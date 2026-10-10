import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { z } from 'zod'
import { defineTool } from '../harness/tool.js'

// Folders that are never worth the model's attention.
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.agentdoctor'])
const MAX_FILES = 500
const MAX_MATCHES = 100
const MAX_LINES = 400

// The eyes of the agent, locked to one repo: every path is checked so the
// model can't read anything outside it (e.g. "../../.ssh/id_rsa").
export function codebaseTools(repoRoot: string) {
  const root = resolve(repoRoot)

  function safePath(path: string) {
    const full = resolve(root, path)
    if (full !== root && !full.startsWith(root + sep)) throw new Error(`Path "${path}" is outside the repo`)
    return full
  }

  async function walk(dir: string, out: string[] = []): Promise<string[]> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (out.length >= MAX_FILES) break
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) await walk(join(dir, entry.name), out)
      } else {
        out.push(relative(root, join(dir, entry.name)))
      }
    }
    return out
  }

  const listFiles = defineTool({
    name: 'listFiles',
    description:
      'List files in the repo (skips node_modules, .git, dist). Optionally restrict to a subfolder. Use this first to see the shape of the codebase.',
    schema: z.object({
      dir: z.string().default('.').describe('Subfolder relative to the repo root'),
    }),
    execute: async ({ dir }) => {
      const files = await walk(safePath(dir))
      return { files: files.sort(), truncated: files.length >= MAX_FILES }
    },
  })

  const searchCode = defineTool({
    name: 'searchCode',
    description:
      'Search file contents with a regular expression. Returns file:line matches. Use it to find where things are defined or used, e.g. "generateText\\(" or "execute:".',
    schema: z.object({
      pattern: z.string().describe('JavaScript regular expression'),
      dir: z.string().default('.').describe('Subfolder to search in'),
    }),
    execute: async ({ pattern, dir }) => {
      const regex = new RegExp(pattern)
      const matches: { file: string; line: number; text: string }[] = []
      for (const file of await walk(safePath(dir))) {
        const lines = (await readFile(join(root, file), 'utf8')).split('\n')
        lines.forEach((text, i) => {
          if (matches.length < MAX_MATCHES && regex.test(text)) matches.push({ file, line: i + 1, text: text.trim() })
        })
        if (matches.length >= MAX_MATCHES) break
      }
      return { matches, truncated: matches.length >= MAX_MATCHES }
    },
  })

  const readCode = defineTool({
    name: 'readFile',
    description:
      'Read a file with line numbers. For big files, pass startLine/endLine to read only a part. Cite what you learn as file:line.',
    schema: z.object({
      path: z.string().describe('File path relative to the repo root'),
      startLine: z.number().int().min(1).default(1),
      endLine: z.number().int().min(1).optional(),
    }),
    execute: async ({ path, startLine, endLine }) => {
      const full = safePath(path)
      if ((await stat(full)).isDirectory()) throw new Error(`"${path}" is a folder, use listFiles`)
      const lines = (await readFile(full, 'utf8')).split('\n')
      const end = Math.min(endLine ?? startLine + MAX_LINES - 1, lines.length, startLine + MAX_LINES - 1)
      const numbered = lines.slice(startLine - 1, end).map((text, i) => `${startLine + i}\t${text}`)
      return { path, startLine, endLine: end, totalLines: lines.length, content: numbered.join('\n') }
    },
  })

  return { listFiles, searchCode, readFile: readCode }
}
