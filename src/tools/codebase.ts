import { execFile } from 'node:child_process'
import { readFile, readdir, stat } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import { z } from 'zod'
import { defineTool } from '../harness/tool.js'
import { truncateHead } from '../harness/truncate.js'

const run = promisify(execFile)
const stripDot = (line: string) => line.replace(/^\.\//, '')
const MAX_LINES = 400
const DEFAULT_LIMIT = 200

// Read-only eyes for the agent, locked to one repo. Every path is checked so the
// model can't read outside it (e.g. "../../.ssh/id_rsa"). find/grep use ripgrep,
// which respects .gitignore like the repo's own tooling does.
export function codebaseTools(repoRoot: string) {
  const root = resolve(repoRoot)

  function safePath(path: string) {
    const full = resolve(root, path)
    if (full !== root && !full.startsWith(root + sep)) throw new Error(`Path "${path}" is outside the repo`)
    return full
  }

  async function rg(args: string[]) {
    try {
      const { stdout } = await run('rg', args, { cwd: root, maxBuffer: 20_000_000 })
      return stdout
    } catch (e) {
      const err = e as { code?: number | string; stdout?: string }
      if (err.code === 1) return err.stdout ?? '' // ripgrep: exit 1 means "no matches"
      if (err.code === 'ENOENT') throw new Error('ripgrep (rg) is not installed. Install it: https://github.com/BurntSushi/ripgrep')
      throw e
    }
  }

  const find = defineTool({
    name: 'find',
    description: 'Find files by glob pattern. Respects .gitignore. Returns paths relative to the repo root.',
    snippet: 'Find files by glob pattern (respects .gitignore)',
    schema: z.object({
      pattern: z.string().describe("Glob, e.g. '*.ts', '**/*.json', 'src/**/*.test.ts'"),
      path: z.string().default('.').describe('Directory to search in'),
      limit: z.number().int().min(1).default(DEFAULT_LIMIT),
    }),
    execute: async ({ pattern, path, limit }) => {
      const dir = relative(root, safePath(path)) || '.'
      const out = await rg(['--files', '--glob', pattern, '--', dir])
      const all = out.split('\n').filter(Boolean).map(stripDot).sort()
      return { files: all.slice(0, limit), total: all.length, limitReached: all.length > limit }
    },
  })

  const grep = defineTool({
    name: 'grep',
    description:
      'Search file contents with a regular expression. Returns file:line:text matches. Respects .gitignore. Use it to find where something is defined or used.',
    snippet: 'Search file contents by regex (respects .gitignore)',
    guidelines: ['Use grep to locate code, then read to see it in full. Cite findings as file:line.'],
    schema: z.object({
      pattern: z.string().describe('Regular expression, e.g. "generateText\\(" or "execute:"'),
      path: z.string().default('.').describe('Directory or file to search in'),
      glob: z.string().optional().describe("Only search files matching this glob, e.g. '*.ts'"),
      ignoreCase: z.boolean().default(false),
      limit: z.number().int().min(1).default(DEFAULT_LIMIT),
    }),
    execute: async ({ pattern, path, glob, ignoreCase, limit }) => {
      const target = relative(root, safePath(path)) || '.'
      const args = ['--line-number', '--no-heading', '--with-filename', '--color=never']
      if (ignoreCase) args.push('--ignore-case')
      if (glob) args.push('--glob', glob)
      args.push('-e', pattern, '--', target)
      const lines = (await rg(args)).split('\n').filter(Boolean).map(stripDot)
      const t = truncateHead(lines.slice(0, limit).join('\n'))
      return { matches: t.text, total: lines.length, limitReached: lines.length > limit, note: t.note }
    },
  })

  const ls = defineTool({
    name: 'ls',
    description: 'List the entries of one directory (not recursive). Folders end with "/".',
    snippet: 'List a directory',
    schema: z.object({ path: z.string().default('.') }),
    execute: async ({ path }) => {
      const entries = await readdir(safePath(path), { withFileTypes: true })
      return { entries: entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).sort() }
    },
  })

  const read = defineTool({
    name: 'read',
    description:
      'Read a file with line numbers. Long files are cut; pass startLine/endLine to read a part. Cite what you learn as file:line.',
    snippet: 'Read a file (with line numbers)',
    guidelines: ['Read a file before making claims about it. If you did not read it, say it is unknown.'],
    schema: z.object({
      path: z.string().describe('File path relative to the repo root'),
      startLine: z.number().int().min(1).default(1),
      endLine: z.number().int().min(1).optional(),
    }),
    execute: async ({ path, startLine, endLine }) => {
      const full = safePath(path)
      if ((await stat(full)).isDirectory()) throw new Error(`"${path}" is a folder, use ls`)
      const lines = (await readFile(full, 'utf8')).split('\n')
      const end = Math.min(endLine ?? startLine + MAX_LINES - 1, lines.length, startLine + MAX_LINES - 1)
      const numbered = lines.slice(startLine - 1, end).map((text, i) => `${startLine + i}\t${text}`)
      const t = truncateHead(numbered.join('\n'))
      const more = end < lines.length ? `File has ${lines.length} lines; showed ${startLine}-${end}. Use startLine=${end + 1} to continue.` : undefined
      return { path, startLine, endLine: end, totalLines: lines.length, content: t.text, note: t.note ?? more }
    },
  })

  return { find, grep, ls, read }
}
