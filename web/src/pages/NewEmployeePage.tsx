import { Alert, Box, Button, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { useCreateEmployee, useReference } from '../api/queries.ts';
import { fieldErrorsFrom, formErrorFrom, SelectField } from '../components/formHelpers.tsx';
import { todayIso } from '../format/date.ts';
import { parseMoney } from '../format/money.ts';
import { useBackToList } from './backToList.ts';
import { useDocumentTitle } from './useDocumentTitle.ts';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  country: '',
  department: '',
  level: '',
  jobTitle: '',
  hireDate: '',
  salary: '',
};

/** `keyof typeof EMPTY_FORM` is the list of field names above, so a typo is a compile error. */
type Field = keyof typeof EMPTY_FORM;

export function NewEmployeePage() {
  useDocumentTitle('Add employee');
  const reference = useReference();
  const create = useCreateEmployee();
  const navigate = useNavigate();
  const backToList = useBackToList();
  const [values, setValues] = useState(EMPTY_FORM);
  const [localErrors, setLocalErrors] = useState<Partial<Record<Field, string>>>({});
  // After a failed send, keyboard focus goes to the first field that needs attention, so a person
  // using a keyboard or a screen reader is not left at the button wondering what happened.
  const form = useRef<HTMLFormElement>(null);
  const [failedSends, setFailedSends] = useState(0);
  useEffect(() => {
    if (failedSends > 0) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [failedSends]);

  const set = (field: Field) => (value: string) => {
    setValues({ ...values, [field]: value });
    // Stop saying "Required" under a field as soon as the person starts filling it in.
    // Only this field is cleared, and the full check runs again on the next submit.
    if (localErrors[field]) setLocalErrors({ ...localErrors, [field]: undefined });
  };

  // The salary is typed in the currency of the chosen country.
  const currency = reference.data?.countries.find((c) => c.code === values.country)?.currency;

  // A field shows the browser-side message first, then whatever the server said about it.
  const serverErrors = fieldErrorsFrom(create.error);
  const errorFor = (field: Field) =>
    localErrors[field] ?? serverErrors[field === 'salary' ? 'salaryMinor' : field];

  function submit(event: FormEvent) {
    event.preventDefault();

    // Checked here only to save a round trip. The server checks everything again.
    const errors: Partial<Record<Field, string>> = {};
    for (const field of Object.keys(EMPTY_FORM) as Field[]) {
      if (values[field].trim() === '') errors[field] = 'Required';
    }
    const salaryMinor = currency ? parseMoney(values.salary, currency) : null;
    if (!errors.salary && salaryMinor === null) {
      errors.salary = 'Enter an amount such as 85000 or 85,000.50. Commas only group thousands.';
    }
    setLocalErrors(errors);
    if (Object.keys(errors).length > 0 || salaryMinor === null) {
      setFailedSends((count) => count + 1);
      return;
    }

    create.mutate(
      {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        country: values.country,
        department: values.department,
        level: values.level,
        jobTitle: values.jobTitle.trim(),
        hireDate: values.hireDate,
        salaryMinor,
      },
      { onSuccess: ({ employee }) => navigate(`/employees/${employee.id}`) },
    );
  }

  const formError = formErrorFrom(create.error);

  return (
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      <Link component={RouterLink} to={backToList} underline="hover">
        Back to employees
      </Link>
      <Typography variant="h5" component="h1">
        Add employee
      </Typography>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <form ref={form} onSubmit={submit} noValidate>
          <Stack spacing={2}>
            {formError && <Alert severity="error">{formError}</Alert>}

            <Box
              sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}
            >
              <TextInput
                label="First name"
                value={values.firstName}
                onChange={set('firstName')}
                error={errorFor('firstName')}
              />
              <TextInput
                label="Last name"
                value={values.lastName}
                onChange={set('lastName')}
                error={errorFor('lastName')}
              />
              <TextInput
                label="Email"
                value={values.email}
                onChange={set('email')}
                error={errorFor('email')}
              />
              <TextInput
                label="Job title"
                value={values.jobTitle}
                onChange={set('jobTitle')}
                error={errorFor('jobTitle')}
              />
              <SelectField
                label="Country"
                value={values.country}
                onChange={set('country')}
                error={errorFor('country')}
                required
                options={(reference.data?.countries ?? []).map((c) => ({
                  value: c.code,
                  label: c.name,
                }))}
              />
              <SelectField
                label="Department"
                value={values.department}
                onChange={set('department')}
                error={errorFor('department')}
                required
                options={(reference.data?.departments ?? []).map((d) => ({ value: d, label: d }))}
              />
              <SelectField
                label="Level"
                value={values.level}
                onChange={set('level')}
                error={errorFor('level')}
                required
                options={(reference.data?.levels ?? []).map((l) => ({ value: l, label: l }))}
              />
              <TextField
                label="Hire date"
                type="date"
                value={values.hireDate}
                onChange={(event) => set('hireDate')(event.target.value)}
                error={Boolean(errorFor('hireDate'))}
                helperText={errorFor('hireDate')}
                required
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayIso() } }}
              />
              <TextInput
                label={currency ? `Starting salary (${currency})` : 'Starting salary'}
                value={values.salary}
                onChange={set('salary')}
                error={errorFor('salary')}
                help={currency ? 'Annual gross base salary' : 'Choose a country first'}
                disabled={!currency}
              />
            </Box>

            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
              <Button component={RouterLink} to={backToList}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={create.isPending}>
                Add employee
              </Button>
            </Stack>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}

function TextInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  help?: string;
  disabled?: boolean;
}) {
  return (
    <TextField
      label={props.label}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
      error={Boolean(props.error)}
      helperText={props.error ?? props.help}
      disabled={props.disabled}
      required
    />
  );
}
