import { Router } from 'express';
import { z } from 'zod';
import {
  AssistantDisabledError,
  UsageLimitError,
  type AssistantService,
} from '../assistant/assistantService.ts';
import {
  ChosenProviderUnavailableError,
  NoProviderAvailableError,
  UnknownProviderError,
} from '../assistant/failover.ts';
import { visitorKeyFor } from '../assistant/visitorKey.ts';
import { HttpError } from '../http/errors.ts';

const askSchema = z.object({
  question: z.string().trim().min(2).max(500),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        // An earlier answer can be about 6,000 characters long, so this must be well above that.
        content: z.string().max(8000),
      }),
    )
    .max(10)
    .default([]),
  provider: z.enum(['gemini', 'groq', 'openrouter', 'nvidia', 'ollama']).optional(),
});

/**
 * Turns what can go wrong inside the assistant into an answer the browser can show.
 * Each message is fixed text. Nothing from inside a provider is ever repeated.
 */
function toHttpError(error: unknown, perVisitorPerHour: number | undefined): unknown {
  if (error instanceof AssistantDisabledError) {
    return new HttpError(404, 'The assistant is not set up');
  }
  if (error instanceof UsageLimitError) {
    const minutes = Math.max(1, Math.ceil(error.retryAfterSeconds / 60));
    const message =
      error.reason === 'visitor'
        ? `You have used your ${perVisitorPerHour ?? ''} questions for this hour. You can ask again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`
        : error.reason === 'daily'
          ? 'The assistant has reached its limit for today. It starts again at midnight UTC.'
          : 'The assistant is busy. Try again in a few minutes.';
    return new HttpError(429, message, {
      body: { reason: error.reason, retryAfterSeconds: error.retryAfterSeconds },
      headers: { 'Retry-After': String(error.retryAfterSeconds) },
    });
  }
  if (error instanceof NoProviderAvailableError) {
    return new HttpError(503, 'No assistant model is available right now. Try again in a minute.', {
      body: { reason: 'no_provider' },
    });
  }
  if (error instanceof ChosenProviderUnavailableError) {
    return new HttpError(
      503,
      `${error.providerLabel} is not available right now. Choose Auto to use another model.`,
      { body: { reason: 'provider_unavailable' } },
    );
  }
  if (error instanceof UnknownProviderError) {
    return new HttpError(400, 'That provider is not set up on this server.');
  }
  return error;
}

/** `assistant` is missing when no provider key is set, and then the assistant is simply off. */
export function assistantRoutes(assistant: AssistantService | undefined): Router {
  const router = Router();

  router.get('/status', (request, response) => {
    response.json(
      assistant?.status(visitorKeyFor(request.ip)) ?? {
        enabled: false,
        providers: [],
        limits: null,
        remainingThisHour: 0,
      },
    );
  });

  router.post('/ask', async (request, response) => {
    if (!assistant) throw new HttpError(404, 'The assistant is not set up');

    const { question, history, provider } = askSchema.parse(request.body);
    try {
      response.json(
        await assistant.ask({
          question,
          history,
          provider,
          // The address of whoever is asking. See "trust proxy" in app.ts.
          visitorId: visitorKeyFor(request.ip),
        }),
      );
    } catch (error) {
      throw toHttpError(error, assistant.status().limits.perVisitorPerHour);
    }
  });

  return router;
}
