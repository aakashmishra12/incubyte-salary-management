import { MenuItem, TextField } from '@mui/material';
import { ApiError } from '../api/client.ts';

/** The server's message for each field it refused, keyed by field name. */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  return Object.fromEntries(error.issues.map((issue) => [issue.field, issue.message]));
}

/**
 * The message to show above a form: the server's reason when it refused the request as a whole.
 * When it refused particular fields, those fields show their own messages and this is empty.
 */
export function formErrorFrom(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError && error.issues.length > 0) return null;
  return error instanceof Error ? error.message : 'Something went wrong';
}

/** A dropdown for a form. */
export function SelectField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  error?: string;
  required?: boolean;
}) {
  return (
    <TextField
      select
      label={props.label}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
      error={Boolean(props.error)}
      helperText={props.error}
      required={props.required}
    >
      {props.options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
