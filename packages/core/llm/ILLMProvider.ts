/**
 * ILLMProvider — Abstraction interface for LLM completion & reasoning.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

export interface LLMResponse {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  finishReason: string;
}

export interface ILLMProvider {
  readonly providerName: string;

  complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMResponse>;

  structuredOutput<T>(
    prompt: string,
    schemaDescription: string,
    options?: LLMCompletionOptions
  ): Promise<T>;
}
