import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { useState, type FormEvent } from 'react';
import { useReference, useUpdateEmployee } from '../api/queries.ts';
import type { Employee, EmployeeChanges } from '../api/types.ts';
import { fieldErrorsFrom, formErrorFrom, SelectField } from './formHelpers.tsx';

const EDITABLE_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'department',
  'level',
  'jobTitle',
] as const;
type Field = (typeof EDITABLE_FIELDS)[number];

/** Corrects an employee's details. Salary, country and hire date are not edited here. */
export function EditDetailsDialog({
  employee,
  onClose,
}: {
  employee: Employee;
  onClose: () => void;
}) {
  const reference = useReference();
  const update = useUpdateEmployee(employee.id);
  const [values, setValues] = useState<Record<Field, string>>({
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    department: employee.department,
    level: employee.level,
    jobTitle: employee.jobTitle,
  });

  const set = (field: Field) => (value: string) => setValues({ ...values, [field]: value });

  // Send only what is different from the stored employee.
  const changes: EmployeeChanges = {};
  for (const field of EDITABLE_FIELDS) {
    if (values[field].trim() !== employee[field]) changes[field] = values[field].trim();
  }
  const hasChanges = Object.keys(changes).length > 0;

  function save(event: FormEvent) {
    event.preventDefault();
    // The button is disabled while saving, but Enter in a field still submits the form.
    if (!hasChanges || update.isPending) return;
    update.mutate(changes, { onSuccess: onClose });
  }

  const errors = fieldErrorsFrom(update.error);
  const formError = formErrorFrom(update.error);
  const text = (field: Field, label: string) => (
    <TextField
      label={label}
      value={values[field]}
      onChange={(event) => set(field)(event.target.value)}
      error={Boolean(errors[field])}
      helperText={errors[field]}
    />
  );

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={save} noValidate>
        <DialogTitle>Edit details</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            {text('firstName', 'First name')}
            {text('lastName', 'Last name')}
            {text('email', 'Email')}
            {text('jobTitle', 'Job title')}
            <SelectField
              label="Department"
              value={values.department}
              onChange={set('department')}
              error={errors.department}
              options={(reference.data?.departments ?? [employee.department]).map((d) => ({
                value: d,
                label: d,
              }))}
            />
            <SelectField
              label="Level"
              value={values.level}
              onChange={set('level')}
              error={errors.level}
              options={(reference.data?.levels ?? [employee.level]).map((l) => ({
                value: l,
                label: l,
              }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={!hasChanges || update.isPending}>
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
