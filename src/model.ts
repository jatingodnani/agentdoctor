import type { LanguageModel } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'

// Bring your own model. AGENTDOCTOR_MODEL="provider:model-id", e.g.
//   anthropic:claude-sonnet-5-5 · nebius:moonshotai/Kimi-K2.5 · ollama:qwen3
// If unset, we use the first provider whose API key is already on the machine.

type Provider = 'anthropic' | 'openai' | 'nebius' | 'openrouter' | 'bedrock' | 'ollama' | 'openai-compatible'

const PROVIDERS: Record<Provider, { keyEnv?: string; defaultModel?: string; make: (id: string) => LanguageModel }> = {
  anthropic: {
    keyEnv: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-5-5',
    make: (id) => createAnthropic()(id),
  },
  openai: {
    keyEnv: 'OPENAI_API_KEY',
    make: (id) => createOpenAI()(id),
  },
  nebius: {
    keyEnv: 'NEBIUS_API_KEY',
    defaultModel: 'moonshotai/Kimi-K2.5',
    make: (id) =>
      createOpenAICompatible({
        name: 'nebius',
        baseURL: 'https://api.tokenfactory.nebius.com/v1',
        apiKey: process.env.NEBIUS_API_KEY,
      })(id),
  },
  openrouter: {
    keyEnv: 'OPENROUTER_API_KEY',
    make: (id) =>
      createOpenAICompatible({
        name: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
      })(id),
  },
  bedrock: {
    keyEnv: 'AWS_ACCESS_KEY_ID',
    make: (id) => createAmazonBedrock()(id),
  },
  // Free and local: Ollama serves an OpenAI-compatible API on localhost.
  ollama: {
    make: (id) =>
      createOpenAICompatible({
        name: 'ollama',
        baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
      })(id),
  },
  // Escape hatch for any other OpenAI-compatible server (Groq, Together, LM Studio, ...).
  'openai-compatible': {
    make: (id) => {
      const baseURL = process.env.AGENTDOCTOR_BASE_URL
      if (!baseURL) throw new Error('openai-compatible needs AGENTDOCTOR_BASE_URL')
      return createOpenAICompatible({ name: 'custom', baseURL, apiKey: process.env.AGENTDOCTOR_API_KEY })(id)
    },
  },
}

export interface ResolvedModel {
  provider: Provider
  modelId: string
  model: LanguageModel
}

export function resolveModel(spec = process.env.AGENTDOCTOR_MODEL): ResolvedModel {
  if (spec) {
    const sep = spec.indexOf(':')
    const provider = (sep === -1 ? spec : spec.slice(0, sep)) as Provider
    const config = PROVIDERS[provider]
    if (!config) throw new Error(`Unknown provider "${provider}". Use one of: ${Object.keys(PROVIDERS).join(', ')}`)
    const modelId = sep === -1 ? config.defaultModel : spec.slice(sep + 1)
    if (!modelId) throw new Error(`Provider "${provider}" needs a model, e.g. ${provider}:<model-id>`)
    if (config.keyEnv && !process.env[config.keyEnv]) throw new Error(`${provider} needs ${config.keyEnv} to be set`)
    return { provider, modelId, model: config.make(modelId) }
  }

  for (const [provider, config] of Object.entries(PROVIDERS) as [Provider, (typeof PROVIDERS)[Provider]][]) {
    if (config.keyEnv && config.defaultModel && process.env[config.keyEnv]) {
      return { provider, modelId: config.defaultModel, model: config.make(config.defaultModel) }
    }
  }

  throw new Error(
    'No model configured. Set AGENTDOCTOR_MODEL (e.g. "anthropic:claude-sonnet-5-5", "nebius:moonshotai/Kimi-K2.5", ' +
      'or "ollama:qwen3" for a free local model), or set an API key like ANTHROPIC_API_KEY or NEBIUS_API_KEY.',
  )
}
