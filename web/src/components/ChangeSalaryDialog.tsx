import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState, type FormEvent } from 'react';
import { useChangeSalary } from '../api/queries.ts';
import type { Employee } from '../api/types.ts';
import { todayIso } from '../format/date.ts';
import { formatMoney, parseMoney, percentChange } from '../format/money.ts';

const MIN_REASON_LENGTH = 3;

interface Props {
  employee: Employee;
  onClose: () => void;
}

/**
 * The form for a new salary. It checks only what it can know on its own (an amount was typed,
 * a reason was given). The date rules are the server's, and its answer is shown as it is.
 */
export function ChangeSalaryDialog({ employee, onClose }: Props) {
  const [salaryText, setSalaryText] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(todayIso());
  const [reason, setReason] = useState('');
  const change = useChangeSalary(employee.id);

  const newSalaryMinor = parseMoney(salaryText, employee.currency);
  const isSameAsCurrent = newSalaryMinor === employee.salaryMinor;
  const canSave =
    newSalaryMinor !== null &&
    !isSameAsCurrent &&
    effectiveDate !== '' &&
    reason.trim().length >= MIN_REASON_LENGTH &&
    !change.isPending;

  function save(event: FormEvent) {
    // Stop the browser from reloading the page, which is what a form does by default.
    event.preventDefault();
    if (!canSave || newSalaryMinor === null) return;

    change.mutate(
      { newSalaryMinor, effectiveDate, reason: reason.trim() },
      // Close only on success. On failure the dialog stays open with everything typed.
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={save} noValidate>
        <DialogTitle>
          Change salary for {employee.firstName} {employee.lastName}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {change.isError && <Alert severity="error">{change.error.message}</Alert>}

            <TextField
              label={`New salary (${employee.currency})`}
              value={salaryText}
              onChange={(event) => setSalaryText(event.target.value)}
              error={salaryText !== '' && (newSalaryMinor === null || isSameAsCurrent)}
              helperText={salaryHelp(salaryText, newSalaryMinor, isSameAsCurrent)}
              autoFocus
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            />

            <Typography variant="body2" color="text.secondary">
              {newSalaryMinor !== null && !isSameAsCurrent
                ? `${formatMoney(employee.salaryMinor, employee.currency)} to ${formatMoney(newSalaryMinor, employee.currency)} (${percentChange(employee.salaryMinor, newSalaryMinor)})`
                : `Current salary: ${formatMoney(employee.salaryMinor, employee.currency)}`}
            </Typography>

            <TextField
              label="Effective date"
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
              // The picker does not offer dates the server would refuse.
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { min: employee.hireDate, max: todayIso() },
              }}
            />

            <TextField
              label="Reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Annual review, promotion, correction"
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={!canSave}>
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function salaryHelp(text: string, parsed: number | null, isSameAsCurrent: boolean): string {
  if (text === '') return 'Annual gross base salary';
  if (parsed === null)
    return 'Enter an amount such as 85000 or 85,000.50. Commas only group thousands.';
  if (isSameAsCurrent) return 'This is the current salary';
  return 'Annual gross base salary';
}
