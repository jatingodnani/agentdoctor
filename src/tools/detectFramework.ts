import { readFile, access } from 'node:fs/promises'
import { join } from 'node:path'

// Known agent frameworks, keyed by the npm package that gives them away.
const FRAMEWORKS: Record<string, string> = {
  ai: 'vercel-ai-sdk',
  '@mastra/core': 'mastra',
  langchain: 'langchain-js',
  '@langchain/core': 'langchain-js',
  '@langchain/langgraph': 'langgraph-js',
  '@openai/agents': 'openai-agents-sdk',
  '@anthropic-ai/claude-agent-sdk': 'claude-agent-sdk',
}

// Raw LLM SDKs. If only these are present, the agent loop is hand-written.
const PROVIDERS: Record<string, string> = {
  '@anthropic-ai/sdk': 'anthropic',
  '@ai-sdk/anthropic': 'anthropic',
  openai: 'openai',
  '@ai-sdk/openai': 'openai',
  '@google/genai': 'google',
  '@ai-sdk/google': 'google',
  '@aws-sdk/client-bedrock-runtime': 'bedrock',
  '@ai-sdk/amazon-bedrock': 'bedrock',
  '@ai-sdk/openai-compatible': 'openai-compatible',
}

const COMMON_ENTRY_FILES = ['src/index.ts', 'src/agent.ts', 'src/main.ts', 'index.ts', 'agent.ts']

export interface FrameworkInfo {
  framework: string
  providers: string[]
  entryCandidates: string[]
  evidence: string[]
}

export async function detectFramework(repoPath: string): Promise<FrameworkInfo> {
  const pkgPath = join(repoPath, 'package.json')
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
  const deps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies }
  const evidence: string[] = []

  const frameworks = Object.keys(deps).filter((d) => d in FRAMEWORKS)
  frameworks.forEach((d) => evidence.push(`package.json depends on "${d}"`))

  const providers = [...new Set(Object.keys(deps).filter((d) => d in PROVIDERS).map((d) => PROVIDERS[d]))]

  let framework = 'unknown'
  if (frameworks.length) framework = FRAMEWORKS[frameworks[0]]
  else if (providers.length) framework = 'hand-written'

  const entryCandidates = new Set<string>()
  if (typeof pkg.main === 'string') entryCandidates.add(pkg.main)
  if (typeof pkg.bin === 'string') entryCandidates.add(pkg.bin)
  if (pkg.bin && typeof pkg.bin === 'object') Object.values<string>(pkg.bin).forEach((b) => entryCandidates.add(b))
  for (const file of COMMON_ENTRY_FILES) {
    if (await exists(join(repoPath, file))) entryCandidates.add(file)
  }

  return { framework, providers, entryCandidates: [...entryCandidates], evidence }
}

async function exists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
