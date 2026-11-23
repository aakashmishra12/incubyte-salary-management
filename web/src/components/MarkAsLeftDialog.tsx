import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { useState, type FormEvent } from 'react';
import { useMarkLeft } from '../api/queries.ts';
import type { Employee } from '../api/types.ts';
import { todayIso } from '../format/date.ts';
import { formErrorFrom } from './formHelpers.tsx';

/** Records that an employee has left. They stay in the data and keep their history. */
export function MarkAsLeftDialog({
  employee,
  onClose,
}: {
  employee: Employee;
  onClose: () => void;
}) {
  const [leftOn, setLeftOn] = useState(todayIso());
  const markLeft = useMarkLeft(employee.id);
  const formError = formErrorFrom(markLeft.error);

  function save(event: FormEvent) {
    event.preventDefault();
    if (leftOn === '') return;
    markLeft.mutate(leftOn, { onSuccess: onClose });
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={save} noValidate>
        <DialogTitle>
          Mark {employee.firstName} {employee.lastName} as left
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <DialogContentText>
              They stay in the list with their salary history, and are left out of the insights.
              Their salary and details can no longer be changed. This cannot be undone here.
            </DialogContentText>
            <TextField
              label="Leaving date"
              type="date"
              value={leftOn}
              onChange={(event) => setLeftOn(event.target.value)}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { min: employee.hireDate, max: todayIso() },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            color="warning"
            disabled={leftOn === '' || markLeft.isPending}
          >
            Mark as left
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
