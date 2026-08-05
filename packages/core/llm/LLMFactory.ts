/**
 * LLMFactory — Automatic provider resolution & fallback engine.
 *
 * Checks environment for available API keys:
 *   1. NEMOTRON_API_KEY / NVIDIA_API_KEY → NemotronProvider
 *   2. Custom OPENAI_COMPATIBLE_API_KEY → Custom OpenAI Provider
 *   3. Fallback: Mock Provider (development mode)
 */

import type { ILLMProvider, LLMMessage, LLMCompletionOptions, LLMResponse } from './ILLMProvider.js';
import { NemotronProvider } from './NemotronProvider.js';

class MockProvider implements ILLMProvider {
  readonly providerName = 'Mock Provider (Dev Fallback)';

  async complete(messages: LLMMessage[]): Promise<LLMResponse> {
    const lastUser = messages.filter(m => m.role === 'user').pop()?.content || '';
    return {
      content: `[Mock LLM Output] Processed requirement: "${lastUser.slice(0, 60)}..."`,
      model: 'mock-dev-model',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      finishReason: 'stop',
    };
  }

  async structuredOutput<T>(_prompt: string, _schemaDescription: string): Promise<T> {
    return {} as T;
  }
}

export class LLMFactory {
  private static instance: ILLMProvider | null = null;

  static getProvider(): ILLMProvider {
    if (this.instance) return this.instance;

    const nemotronKey = process.env['NEMOTRON_API_KEY'] || process.env['NVIDIA_API_KEY'];
    if (nemotronKey) {
      console.log('⚡ [LLMFactory] Initialized NVIDIA Nemotron Provider (llama-3.1-nemotron-70b-instruct)');
      this.instance = new NemotronProvider({ apiKey: nemotronKey });
      return this.instance;
    }

    console.log('💡 [LLMFactory] No live API key detected. Using Mock Dev Provider.');
    this.instance = new MockProvider();
    return this.instance;
  }

  static setProvider(provider: ILLMProvider): void {
    this.instance = provider;
  }
}
