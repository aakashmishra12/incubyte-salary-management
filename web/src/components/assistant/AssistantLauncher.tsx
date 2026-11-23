import {
  Alert,
  Box,
  Button,
  Chip,
  Drawer,
  Fab,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  SvgIcon,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/client.ts';
import type { AssistantAnswer, AssistantStatus } from '../../api/assistant.ts';
import { useAskAssistant, useAssistantStatus } from '../../api/queries.ts';

const MAX_QUESTION_LENGTH = 500;
const HISTORY_MESSAGES = 6;

const EXAMPLE_QUESTIONS = [
  'How much do we spend on salaries in each country?',
  'What does a level 3 engineer earn in each country?',
  'Who is paid furthest above their peers?',
  'Who are the five highest paid people in India?',
];

/** One line of the conversation. */
type Item = { role: 'user'; text: string } | { role: 'assistant'; answer: AssistantAnswer };

/**
 * The round button at the bottom right, and the panel it opens.
 * It appears only when the server says the assistant is set up. If the status cannot be read,
 * it stays out of the way, so the assistant can never get in the way of the rest of the app.
 */
export function AssistantLauncher() {
  const status = useAssistantStatus();
  const [isOpen, setIsOpen] = useState(false);

  if (!status.data?.enabled) return null;

  return (
    <>
      <Fab
        color="primary"
        aria-label="Ask the pay assistant"
        onClick={() => {
          setIsOpen(true);
          // The state of each provider changes during the day, so look again when the panel opens.
          status.refetch();
        }}
        sx={{ position: 'fixed', right: 24, bottom: 24 }}
      >
        <SparkIcon />
      </Fab>
      {/* keepMounted keeps the conversation when the panel is closed and opened again. */}
      <Drawer
        anchor="right"
        open={isOpen}
        onClose={() => setIsOpen(false)}
        keepMounted
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-label': 'Pay assistant',
            sx: { width: { xs: '100vw', sm: 440 } },
          },
        }}
      >
        <AssistantPanel status={status.data} onClose={() => setIsOpen(false)} />
      </Drawer>
    </>
  );
}

function AssistantPanel({ status, onClose }: { status: AssistantStatus; onClose: () => void }) {
  const ask = useAskAssistant();
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const endOfConversation = useRef<HTMLDivElement>(null);

  const left = remaining ?? status.limits?.perVisitorPerHour ?? 0;

  // Keep the newest message in view. (Not every environment can scroll, so check first.)
  useEffect(() => {
    endOfConversation.current?.scrollIntoView?.({ block: 'end' });
  }, [items, ask.isPending, error]);

  function send(text: string) {
    const question = text.trim();
    if (!question || ask.isPending) return;
    setError(null);

    const history = items
      .slice(-HISTORY_MESSAGES)
      .map((item) =>
        item.role === 'user'
          ? { role: 'user' as const, content: item.text }
          : { role: 'assistant' as const, content: item.answer.answer },
      );

    ask.mutate(
      { question, history, provider: provider || undefined },
      {
        onSuccess: (answer) => {
          setItems((current) => [
            ...current,
            { role: 'user', text: question },
            { role: 'assistant', answer },
          ]);
          setRemaining(answer.remainingThisHour);
          setInput('');
        },
        onError: (failure) => {
          setError(messageFor(failure));
          // Nothing the person typed is lost.
          setInput(question);
        },
      },
    );
  }

  return (
    <Stack sx={{ height: '100%' }}>
      <Stack
        direction="row"
        sx={{
          p: 2,
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box>
          <Typography variant="h6" component="h2">
            Pay assistant
          </Typography>
          <Typography variant="caption" color="text.secondary" aria-live="polite">
            {left} {left === 1 ? 'question' : 'questions'} left this hour
          </Typography>
        </Box>
        <IconButton aria-label="Close the assistant" onClick={onClose}>
          <Box component="span" aria-hidden sx={{ fontSize: 22, lineHeight: 1 }}>
            ×
          </Box>
        </IconButton>
      </Stack>

      <Box sx={{ px: 2, pt: 2 }}>
        <TextField
          select
          size="small"
          fullWidth
          label="Model"
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
          helperText="Auto switches to another model if one is busy."
        >
          <MenuItem value="">Auto</MenuItem>
          {status.providers.map((p) => (
            <MenuItem key={p.id} value={p.id} disabled={p.state !== 'ready'}>
              {providerLabel(p)}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <Stack spacing={2} sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {items.length === 0 && !ask.isPending && (
          <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
            <Typography color="text.secondary" variant="body2">
              Ask about pay in plain words. Answers use the same figures as the other screens, and
              show what they are based on.
            </Typography>
            {EXAMPLE_QUESTIONS.map((example) => (
              <Chip
                key={example}
                label={example}
                variant="outlined"
                onClick={() => send(example)}
                sx={{ height: 'auto', py: 0.75, '& .MuiChip-label': { whiteSpace: 'normal' } }}
              />
            ))}
          </Stack>
        )}

        {items.map((item, index) =>
          item.role === 'user' ? (
            <Bubble key={index} text={item.text} fromUser />
          ) : (
            <Box key={index}>
              <Bubble text={item.answer.answer} />
              {item.answer.sources.length > 0 && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.5 }}
                >
                  Based on: {item.answer.sources.join(' · ')}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {item.answer.cached
                  ? 'Remembered answer, no model used'
                  : `Answered by ${item.answer.providerLabel ?? 'the assistant'}`}
              </Typography>
            </Box>
          ),
        )}

        {ask.isPending && ask.variables && (
          <>
            <Bubble text={ask.variables.question} fromUser />
            <Box>
              <Typography variant="body2" color="text.secondary">
                Thinking…
              </Typography>
              <LinearProgress />
            </Box>
          </>
        )}

        {error && <Alert severity="error">{error}</Alert>}
        <div ref={endOfConversation} />
      </Stack>

      <Stack spacing={1} sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <TextField
          label="Your question"
          multiline
          maxRows={4}
          fullWidth
          size="small"
          value={input}
          onChange={(event) => setInput(event.target.value.slice(0, MAX_QUESTION_LENGTH))}
          onKeyDown={(event) => {
            // Enter sends. Shift+Enter starts a new line. Enter while composing text (for example
            // with an input method for another script) must not send.
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send(input);
            }
          }}
          slotProps={{ htmlInput: { maxLength: MAX_QUESTION_LENGTH } }}
        />
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {input.length} / {MAX_QUESTION_LENGTH}
          </Typography>
          <Button
            variant="contained"
            onClick={() => send(input)}
            disabled={input.trim() === '' || ask.isPending}
          >
            Send
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}

/** A message. The line breaks in an answer are kept, so a list stays a list. */
function Bubble({ text, fromUser = false }: { text: string; fromUser?: boolean }) {
  return (
    <Typography
      variant="body2"
      sx={{
        whiteSpace: 'pre-wrap',
        alignSelf: fromUser ? 'flex-end' : 'flex-start',
        maxWidth: '92%',
        px: 1.5,
        py: 1,
        borderRadius: 2,
        bgcolor: fromUser ? 'action.hover' : 'transparent',
        border: fromUser ? 'none' : 1,
        borderColor: 'divider',
        ...(fromUser ? { ml: 'auto', width: 'fit-content' } : {}),
      }}
    >
      {text}
    </Typography>
  );
}

function providerLabel(provider: AssistantStatus['providers'][number]): string {
  switch (provider.state) {
    case 'ready':
      return provider.label;
    case 'cooling_down':
      return `${provider.label} (resting)`;
    case 'daily_limit_reached':
      return `${provider.label} (daily limit reached)`;
    case 'misconfigured':
      return `${provider.label} (needs attention)`;
  }
}

/** The server's own wording is plain and specific, so it is shown as it is. */
function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    return [400, 404, 429, 503].includes(error.status)
      ? error.message
      : 'The assistant could not answer. Try again.';
  }
  return 'Could not reach the server. Check your connection and try again.';
}

/** A four-pointed spark, drawn here so the app needs no icon library. */
function SparkIcon() {
  return (
    <SvgIcon>
      <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" />
    </SvgIcon>
  );
}
