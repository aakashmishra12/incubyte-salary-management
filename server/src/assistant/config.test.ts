import { describe, expect, it } from 'vitest';
import { loadAssistantConfig } from './config.ts';

describe('loadAssistantConfig', () => {
  it('has no providers when no key is set, so the assistant is off', () => {
    const config = loadAssistantConfig({});

    expect(config.providers).toEqual([]);
  });

  it('turns on a provider when its key is set', () => {
    const config = loadAssistantConfig({ GROQ_API_KEY: 'g-key' });

    expect(config.providers).toHaveLength(1);
    expect(config.providers[0]).toMatchObject({
      id: 'groq',
      label: 'Groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: 'g-key',
    });
  });

  it('tries providers in the default order: Gemini, Groq, OpenRouter, then a local model', () => {
    const config = loadAssistantConfig({
      OPENROUTER_API_KEY: 'o-key',
      GROQ_API_KEY: 'g-key',
      GEMINI_API_KEY: 'm-key',
      OLLAMA_MODEL: 'llama3.1',
    });

    expect(config.providers.map((p) => p.id)).toEqual(['gemini', 'groq', 'openrouter', 'ollama']);
  });

  it('turns on Gemini through its OpenAI-style address, with a budget under its free daily limit', () => {
    const config = loadAssistantConfig({ GEMINI_API_KEY: 'm-key' });

    expect(config.providers[0]).toMatchObject({
      id: 'gemini',
      label: 'Gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      apiKey: 'm-key',
      model: 'gemini-3.5-flash',
      dailyLimit: 18,
    });
  });

  it('follows the order in ASSISTANT_PROVIDERS and leaves out any provider not listed', () => {
    const config = loadAssistantConfig({
      ASSISTANT_PROVIDERS: 'openrouter, groq',
      GROQ_API_KEY: 'g-key',
      OPENROUTER_API_KEY: 'o-key',
      OLLAMA_MODEL: 'llama3.1',
    });

    expect(config.providers.map((p) => p.id)).toEqual(['openrouter', 'groq']);
  });

  it('ignores a name in ASSISTANT_PROVIDERS that it does not know', () => {
    const config = loadAssistantConfig({ ASSISTANT_PROVIDERS: 'nonsense,groq', GROQ_API_KEY: 'k' });

    expect(config.providers.map((p) => p.id)).toEqual(['groq']);
  });

  it('turns on a local Ollama with a model name and no key', () => {
    const config = loadAssistantConfig({ OLLAMA_MODEL: 'qwen2.5:7b' });

    expect(config.providers[0]).toMatchObject({
      id: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      model: 'qwen2.5:7b',
    });
    expect(config.providers[0]!.apiKey).toBeUndefined();
  });

  it('lets the model name and the daily budget be set, and gives each provider a default budget', () => {
    const config = loadAssistantConfig({
      GROQ_API_KEY: 'g',
      GROQ_MODEL: 'my-model',
      GROQ_DAILY_LIMIT: '250',
      OPENROUTER_API_KEY: 'o',
    });

    expect(config.providers[0]).toMatchObject({ id: 'groq', model: 'my-model', dailyLimit: 250 });
    // OpenRouter's free tier allows 50 requests a day, so the default stays below that.
    expect(config.providers[1]!.dailyLimit).toBe(45);
  });

  it('ignores a key that is empty or only spaces', () => {
    const config = loadAssistantConfig({ GROQ_API_KEY: '   ' });

    expect(config.providers).toEqual([]);
  });

  it('has sensible limits by default and lets them be set', () => {
    expect(loadAssistantConfig({}).limits).toEqual({ perVisitorPerHour: 20, perDay: 300 });
    expect(
      loadAssistantConfig({ ASSISTANT_PER_VISITOR_PER_HOUR: '5', ASSISTANT_PER_DAY: '50' }).limits,
    ).toEqual({ perVisitorPerHour: 5, perDay: 50 });
  });

  it('falls back to the default when a number is not a positive whole number', () => {
    const config = loadAssistantConfig({
      ASSISTANT_PER_DAY: 'lots',
      ASSISTANT_PER_VISITOR_PER_HOUR: '-3',
      GROQ_API_KEY: 'g',
      GROQ_DAILY_LIMIT: '0',
    });

    expect(config.limits).toEqual({ perVisitorPerHour: 20, perDay: 300 });
    expect(config.providers[0]!.dailyLimit).toBe(500);
  });

  it('describes itself without ever printing a key', () => {
    const config = loadAssistantConfig({
      GROQ_API_KEY: 'super-secret',
      OPENROUTER_API_KEY: 'also-secret',
    });

    expect(config.describe()).toBe('Assistant providers: Groq, OpenRouter');
    expect(config.describe()).not.toContain('secret');
  });
});
