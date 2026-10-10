// Try tools by hand before wiring them to the AI.
// Usage: pnpm try <path-to-agent-repo>
import { codebaseTools } from '../src/tools/codebase.js'

const repo = process.argv[2] ?? 'targets/sales-agent'
const { listFiles, searchCode, readFile } = codebaseTools(repo)

console.log('--- listFiles');        console.log(await listFiles.execute({ dir: '.' }))
console.log('--- searchCode "execute:"'); console.log(await searchCode.execute({ pattern: 'execute:', dir: '.' }))
console.log('--- readFile src/tools.ts 1-12'); console.log((await readFile.execute({ path: 'src/tools.ts', startLine: 1, endLine: 12 })).content)
console.log('--- safety: readFile ../../package.json')
try { await readFile.execute({ path: '../../package.json', startLine: 1 }) } catch (e) { console.log('BLOCKED:', (e as Error).message) }
