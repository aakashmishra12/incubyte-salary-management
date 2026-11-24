import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderPage, stubApi } from '../../testing/render.tsx';
import { AssistantLauncher } from './AssistantLauncher.tsx';

/** What the server says is left for this visitor. Each question asked takes one away. */
const server = { remaining: 20 };

const status = {
  enabled: true,
  providers: [
    { id: 'gemini', label: 'Gemini', state: 'ready' },
    { id: 'groq', label: 'Groq', state: 'cooling_down' },
  ],
  limits: { perVisitorPerHour: 20 },
};

const currentStatus = () => ({ ...status, remainingThisHour: server.remaining });

const answer = (overrides = {}) => ({
  answer: 'The United States costs the most.\n- US: USD 268,985,000',
  sources: ['Company overview'],
  provider: 'gemini',
  providerLabel: 'Gemini',
  cached: false,
  remainingThisHour: 19,
  ...overrides,
});

const refusal = (status: number, error: string, extra = {}) =>
  new Response(JSON.stringify({ error, ...extra }), { status });

function setup(handlers: Parameters<typeof stubApi>[0] = {}, remaining = 20) {
  server.remaining = remaining;
  const requests = stubApi({
    'GET /api/assistant/status': () => currentStatus(),
    'POST /api/assistant/ask': () => {
      server.remaining -= 1;
      return answer({ remainingThisHour: server.remaining });
    },
    ...handlers,
  });
  renderPage(<AssistantLauncher />);
  return requests;
}

async function openPanel() {
  await userEvent.click(await screen.findByRole('button', { name: 'Ask the pay assistant' }));
  return within(await screen.findByRole('dialog', { name: 'Pay assistant' }));
}

const questionsAsked = (requests: ReturnType<typeof stubApi>) =>
  requests.filter((request) => request.method === 'POST').map((request) => request.body);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AssistantLauncher: whether it appears', () => {
  it('shows a button when the assistant is set up', async () => {
    setup();

    expect(
      await screen.findByRole('button', { name: 'Ask the pay assistant' }),
    ).toBeInTheDocument();
  });

  it('shows nothing when the server says the assistant is off', async () => {
    setup({
      'GET /api/assistant/status': () => ({
        enabled: false,
        providers: [],
        limits: null,
        remainingThisHour: 0,
      }),
    });

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Ask the pay assistant' })).not.toBeInTheDocument();
  });

  it('shows nothing when the status cannot be read, so the rest of the app is unaffected', async () => {
    setup({ 'GET /api/assistant/status': () => new Response('{}', { status: 500 }) });

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Ask the pay assistant' })).not.toBeInTheDocument();
  });
});

describe('AssistantLauncher: the panel', () => {
  it('offers example questions and says how many questions are left this hour', async () => {
    setup();

    const panel = await openPanel();

    expect(
      panel.getByRole('button', { name: 'Who is paid furthest above their peers?' }),
    ).toBeInTheDocument();
    expect(panel.getByText('20 questions left this hour')).toBeInTheDocument();
  });

  it('asks an example question when I click it, and shows the answer, its sources and who gave it', async () => {
    const requests = setup();
    const panel = await openPanel();

    await userEvent.click(
      panel.getByRole('button', { name: 'Who is paid furthest above their peers?' }),
    );

    expect(await panel.findByText(/The United States costs the most/)).toBeInTheDocument();
    expect(panel.getByText('Who is paid furthest above their peers?')).toBeInTheDocument();
    expect(panel.getByText('Based on: Company overview')).toBeInTheDocument();
    expect(panel.getByText('Answered by Gemini')).toBeInTheDocument();
    expect(questionsAsked(requests)).toEqual([
      { question: 'Who is paid furthest above their peers?', history: [] },
    ]);
  });

  it('keeps the line breaks in an answer, so a list stays a list', async () => {
    setup();
    const panel = await openPanel();

    await userEvent.type(panel.getByLabelText('Your question'), 'Costs?{Enter}');

    const text = await panel.findByText(/The United States costs the most/);
    expect(text.textContent).toBe('The United States costs the most.\n- US: USD 268,985,000');
    expect(getComputedStyle(text).whiteSpace).toBe('pre-wrap');
  });

  it('updates how many questions are left after each answer', async () => {
    setup();
    const panel = await openPanel();

    await userEvent.type(panel.getByLabelText('Your question'), 'Costs?{Enter}');

    expect(await panel.findByText('19 questions left this hour')).toBeInTheDocument();
  });

  it('marks an answer that came from memory', async () => {
    setup({ 'POST /api/assistant/ask': () => answer({ cached: true }) });
    const panel = await openPanel();

    await userEvent.type(panel.getByLabelText('Your question'), 'Costs?{Enter}');

    expect(await panel.findByText('Remembered answer, no model used')).toBeInTheDocument();
  });
});

describe('AssistantLauncher: typing a question', () => {
  it('sends on Enter and clears the box', async () => {
    const requests = setup();
    const panel = await openPanel();
    const box = panel.getByLabelText('Your question');

    await userEvent.type(box, 'How many people?{Enter}');

    await panel.findByText(/The United States costs the most/);
    expect(questionsAsked(requests)).toEqual([{ question: 'How many people?', history: [] }]);
    expect(box).toHaveValue('');
  });

  it('starts a new line on Shift+Enter instead of sending', async () => {
    const requests = setup();
    const panel = await openPanel();

    await userEvent.type(
      panel.getByLabelText('Your question'),
      'Line one{Shift>}{Enter}{/Shift}line two',
    );

    expect(panel.getByLabelText('Your question')).toHaveValue('Line one\nline two');
    expect(questionsAsked(requests)).toEqual([]);
  });

  it('cannot send an empty question', async () => {
    const panel = await openPanel_();
    expect(panel.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('shows how many characters are left, and stops at 500', async () => {
    setup();
    const panel = await openPanel();

    await userEvent.click(panel.getByLabelText('Your question'));
    await userEvent.paste('x'.repeat(520));

    expect(panel.getByLabelText('Your question')).toHaveValue('x'.repeat(500));
    expect(panel.getByText('500 / 500')).toBeInTheDocument();
  });

  it('does not send a second question while one is being answered', async () => {
    let release: (value: Response) => void = () => {};
    const requests = setup({
      'POST /api/assistant/ask': () =>
        new Promise<Response>((resolve) => (release = resolve)) as unknown as Response,
    });
    const panel = await openPanel();

    await userEvent.type(panel.getByLabelText('Your question'), 'First{Enter}');
    expect(await panel.findByText('Thinking…')).toBeInTheDocument();
    expect(panel.getByRole('button', { name: 'Send' })).toBeDisabled();
    await userEvent.type(panel.getByLabelText('Your question'), 'Second{Enter}');

    expect(questionsAsked(requests)).toHaveLength(1);
    release(Response.json(answer()));
  });

  it('sends the earlier messages with a follow-up question', async () => {
    const requests = setup();
    const panel = await openPanel();
    await userEvent.type(panel.getByLabelText('Your question'), 'Costs?{Enter}');
    await panel.findByText(/The United States costs the most/);

    await userEvent.type(panel.getByLabelText('Your question'), 'And in India?{Enter}');

    await waitFor(() => expect(questionsAsked(requests)).toHaveLength(2));
    expect(questionsAsked(requests)[1]).toEqual({
      question: 'And in India?',
      history: [
        { role: 'user', content: 'Costs?' },
        { role: 'assistant', content: 'The United States costs the most.\n- US: USD 268,985,000' },
      ],
    });
  });
});

describe('AssistantLauncher: choosing a model', () => {
  it('offers Auto and each provider with its state, and does not offer one that is resting', async () => {
    setup();
    const panel = await openPanel();

    await userEvent.click(panel.getByLabelText('Model'));

    expect(await screen.findByRole('option', { name: 'Auto' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Gemini' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Groq (resting)' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('sends the chosen provider with the question', async () => {
    const requests = setup();
    const panel = await openPanel();

    await userEvent.click(panel.getByLabelText('Model'));
    await userEvent.click(await screen.findByRole('option', { name: 'Gemini' }));
    await userEvent.type(panel.getByLabelText('Your question'), 'Costs?{Enter}');

    await panel.findByText(/The United States costs the most/);
    expect(questionsAsked(requests)).toEqual([
      { question: 'Costs?', history: [], provider: 'gemini' },
    ]);
  });
});

describe('AssistantLauncher: when it cannot answer', () => {
  it.each([
    [429, 'You have used your 20 questions for this hour. You can ask again in 12 minutes.'],
    [503, 'No assistant model is available right now. Try again in a minute.'],
  ])('shows the server message for a %i, and keeps what I typed', async (code, message) => {
    setup({ 'POST /api/assistant/ask': () => refusal(code, message) });
    const panel = await openPanel();

    await userEvent.type(panel.getByLabelText('Your question'), 'Costs?{Enter}');

    expect(await panel.findByText(message)).toBeInTheDocument();
    expect(panel.getByLabelText('Your question')).toHaveValue('Costs?');
  });

  it('says the assistant is not set up on a 404', async () => {
    setup({ 'POST /api/assistant/ask': () => refusal(404, 'The assistant is not set up') });
    const panel = await openPanel();

    await userEvent.type(panel.getByLabelText('Your question'), 'Costs?{Enter}');

    expect(await panel.findByText('The assistant is not set up')).toBeInTheDocument();
  });

  it('says so plainly when the server cannot be reached', async () => {
    setup({
      'POST /api/assistant/ask': () =>
        Promise.reject(new TypeError('fetch failed')) as unknown as Response,
    });
    const panel = await openPanel();

    await userEvent.type(panel.getByLabelText('Your question'), 'Costs?{Enter}');

    expect(
      await panel.findByText('Could not reach the server. Check your connection and try again.'),
    ).toBeInTheDocument();
  });

  it('clears the error when I try again and it works', async () => {
    let fail = true;
    setup({
      'POST /api/assistant/ask': () =>
        fail
          ? refusal(503, 'No assistant model is available right now. Try again in a minute.')
          : answer(),
    });
    const panel = await openPanel();
    await userEvent.type(panel.getByLabelText('Your question'), 'Costs?{Enter}');
    await panel.findByText(/No assistant model is available/);

    fail = false;
    await userEvent.click(panel.getByRole('button', { name: 'Send' }));

    await panel.findByText(/The United States costs the most/);
    expect(panel.queryByText(/No assistant model is available/)).not.toBeInTheDocument();
  });
});

describe('AssistantLauncher: the count of questions left', () => {
  it('is what the server says, so it is right after a reload and not always the full allowance', async () => {
    setup({}, 7);

    const panel = await openPanel();

    expect(panel.getByText('7 questions left this hour')).toBeInTheDocument();
  });

  it('says "1 question", not "1 questions"', async () => {
    setup({}, 1);

    const panel = await openPanel();

    expect(panel.getByText('1 question left this hour')).toBeInTheDocument();
  });

  it('shows none left after the server refuses a question for the hourly limit', async () => {
    setup({
      'POST /api/assistant/ask': () => {
        server.remaining = 0;
        return refusal(
          429,
          'You have used your 20 questions for this hour. You can ask again in 40 minutes.',
          {
            reason: 'visitor',
          },
        );
      },
    });
    const panel = await openPanel();

    await userEvent.type(panel.getByLabelText('Your question'), 'Costs?{Enter}');

    expect(await panel.findByText('0 questions left this hour')).toBeInTheDocument();
  });

  it('asks the server again each time the panel is opened', async () => {
    const requests = setup();
    await screen.findByRole('button', { name: 'Ask the pay assistant' });
    const statusRequests = () =>
      requests.filter((r) => r.url.pathname === '/api/assistant/status').length;
    const before = statusRequests();

    await openPanel();

    await vi.waitFor(() => expect(statusRequests()).toBeGreaterThan(before));
  });
});

describe('AssistantLauncher: reading it with a screen reader', () => {
  it('announces new answers, because the conversation is a live region', async () => {
    setup();
    const panel = await openPanel();

    const log = panel.getByRole('log');

    expect(log).toHaveAttribute('aria-live', 'polite');
  });

  it('announces that it is thinking', async () => {
    setup({
      'POST /api/assistant/ask': () => new Promise<Response>(() => {}) as unknown as Response,
    });
    const panel = await openPanel();

    await userEvent.type(panel.getByLabelText('Your question'), 'Costs?{Enter}');

    expect(await panel.findByRole('status')).toHaveTextContent('Thinking…');
  });
});

describe('AssistantLauncher: questions that should not be sent', () => {
  it('cannot send a question of one character, which the server would refuse', async () => {
    setup();
    const panel = await openPanel();

    await userEvent.type(panel.getByLabelText('Your question'), 'a');
    expect(panel.getByRole('button', { name: 'Send' })).toBeDisabled();
    await userEvent.type(panel.getByLabelText('Your question'), 'b');

    expect(panel.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('does not send while text is being composed with an input method, even when it reports Enter', async () => {
    const requests = setup();
    const panel = await openPanel();
    const box = panel.getByLabelText('Your question');
    await userEvent.type(box, 'Costs?');

    fireEvent.keyDown(box, { key: 'Enter', isComposing: true });
    // Some browsers report the Enter that ends composing as keyCode 229 with isComposing already false.
    fireEvent.keyDown(box, { key: 'Enter', keyCode: 229 });

    expect(questionsAsked(requests)).toEqual([]);
  });

  it("explains a refused question in words, from the server's own reason", async () => {
    setup({
      'POST /api/assistant/ask': () =>
        refusal(400, 'Invalid request', { issues: [{ field: 'question', message: 'Too small' }] }),
    });
    const panel = await openPanel();

    await userEvent.type(panel.getByLabelText('Your question'), 'Costs?{Enter}');

    expect(
      await panel.findByText('That question could not be sent: question: Too small.'),
    ).toBeInTheDocument();
  });
});

describe('AssistantLauncher: keeping what was typed', () => {
  it('puts a failed question back in the box when the box is empty', async () => {
    setup({
      'POST /api/assistant/ask': () =>
        refusal(503, 'No assistant model is available right now. Try again in a minute.'),
    });
    const panel = await openPanel();

    await userEvent.type(panel.getByLabelText('Your question'), 'Costs?{Enter}');

    await panel.findByText(/No assistant model is available/);
    expect(panel.getByLabelText('Your question')).toHaveValue('Costs?');
  });

  it('does not overwrite what was typed while waiting', async () => {
    let fail: (response: Response) => void = () => {};
    setup({
      'POST /api/assistant/ask': () =>
        new Promise<Response>((resolve) => (fail = resolve)) as unknown as Response,
    });
    const panel = await openPanel();
    await userEvent.type(panel.getByLabelText('Your question'), 'Costs?{Enter}');
    await panel.findByRole('status');

    await userEvent.type(panel.getByLabelText('Your question'), 'Something else');
    fail(refusal(503, 'No assistant model is available right now. Try again in a minute.'));

    await panel.findByText(/No assistant model is available/);
    expect(panel.getByLabelText('Your question')).toHaveValue('Something else');
  });
});

describe('AssistantLauncher: what each answer shows', () => {
  it('shows no "Based on" line when an answer used no data', async () => {
    setup({ 'POST /api/assistant/ask': () => answer({ sources: [] }) });
    const panel = await openPanel();

    await userEvent.type(panel.getByLabelText('Your question'), 'Costs?{Enter}');

    await panel.findByText(/The United States costs the most/);
    expect(panel.queryByText(/Based on:/)).not.toBeInTheDocument();
  });

  it('sends at most the last six messages of the conversation', async () => {
    const requests = setup();
    const panel = await openPanel();

    for (const question of ['One?', 'Two?', 'Three?', 'Four?']) {
      await userEvent.type(panel.getByLabelText('Your question'), `${question}{Enter}`);
      await waitFor(() => expect(panel.getByLabelText('Your question')).toHaveValue(''));
      await panel.findByText(new RegExp(`${question}`));
    }

    const history = (questionsAsked(requests).at(-1) as { history: unknown[] }).history;
    expect(history).toHaveLength(6);
  });
});

/** Opens the panel with the default setup. */
async function openPanel_() {
  setup();
  return openPanel();
}
