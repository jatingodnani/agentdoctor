// Try tools by hand before wiring them to the AI.
// Usage: pnpm try <path-to-agent-repo>
import { codebaseTools } from '../src/tools/codebase.js'

const repo = process.argv[2] ?? 'targets/sales-agent'
const { find, grep, ls, read } = codebaseTools(repo)

console.log('--- ls .');                     console.log(await ls.execute({ path: '.' }))
console.log('--- find *.ts');                console.log(await find.execute({ pattern: '*.ts', path: '.', limit: 50 }))
console.log('--- grep "execute:"');          console.log(await grep.execute({ pattern: 'execute:', path: '.', ignoreCase: false, limit: 50 }))
console.log('--- grep no match');            console.log(await grep.execute({ pattern: 'zzz_nothing_zzz', path: '.', ignoreCase: false, limit: 50 }))
console.log('--- read src/tools.ts 1-12');   console.log((await read.execute({ path: 'src/tools.ts', startLine: 1, endLine: 12 })).content)
console.log('--- .gitignore respected? (no vendor folders should appear)')
console.log((await find.execute({ pattern: '*.json', path: '.', limit: 50 })).files)
for (const p of ['../../package.json', '/etc/hosts']) {
  try { await read.execute({ path: p, startLine: 1 }) } catch (e) { console.log(`BLOCKED ${p}:`, (e as Error).message) }
}
