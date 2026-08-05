/**
 * NemotronProvider — LLM Provider for NVIDIA Nemotron (NIM API).
 *
 * Models supported:
 *   - nvidia/llama-3.1-nemotron-70b-instruct (Default)
 *   - nvidia/nemotron-4-340b-instruct
 *   - nvidia/nemotron-mini-4b-instruct
 *
 * Endpoint: https://integrate.api.nvidia.com/v1/chat/completions
 * OpenAI-compatible format.
 */

import type { ILLMProvider, LLMMessage, LLMCompletionOptions, LLMResponse } from './ILLMProvider.js';

export class NemotronProvider implements ILLMProvider {
  readonly providerName = 'NVIDIA Nemotron';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(config?: { apiKey?: string; baseUrl?: string; defaultModel?: string }) {
    this.apiKey = config?.apiKey || process.env['NEMOTRON_API_KEY'] || process.env['NVIDIA_API_KEY'] || '';
    this.baseUrl = config?.baseUrl || process.env['NEMOTRON_BASE_URL'] || 'https://integrate.api.nvidia.com/v1';
    this.defaultModel = config?.defaultModel || process.env['NEMOTRON_MODEL'] || 'nvidia/llama-3.1-nemotron-70b-instruct';
  }

  async complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error(
        '[NemotronProvider] API Key missing. Please set NEMOTRON_API_KEY or NVIDIA_API_KEY in your environment variables.'
      );
    }

    const model = options?.model || this.defaultModel;
    const body = {
      model,
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 2048,
      ...(options?.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`[NemotronProvider] API HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json() as any;
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content || '',
      model: data.model || model,
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
      finishReason: choice?.finish_reason || 'stop',
    };
  }

  async structuredOutput<T>(
    prompt: string,
    schemaDescription: string,
    options?: LLMCompletionOptions
  ): Promise<T> {
    const systemPrompt =
      `You are an AI workforce agent powered by NVIDIA Nemotron. ` +
      `Respond strictly in valid JSON matching this schema:\n${schemaDescription}\n` +
      `Do not wrap in markdown code blocks unless requested. Output ONLY raw valid JSON.`;

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    const response = await this.complete(messages, { ...options, responseFormat: 'json' });

    let cleanJson = response.content.trim();
    if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
    if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
    if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);

    return JSON.parse(cleanJson.trim()) as T;
  }
}
