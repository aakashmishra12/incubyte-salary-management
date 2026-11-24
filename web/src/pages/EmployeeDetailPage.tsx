import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useBackToList } from './backToList.ts';
import { useDocumentTitle } from './useDocumentTitle.ts';
import { Link as RouterLink, useParams } from 'react-router';
import { useEmployee, useReference } from '../api/queries.ts';
import { ChangeSalaryDialog } from '../components/ChangeSalaryDialog.tsx';
import { EditDetailsDialog } from '../components/EditDetailsDialog.tsx';
import { MarkAsLeftDialog } from '../components/MarkAsLeftDialog.tsx';
import { formatDate } from '../format/date.ts';
import { formatMoney, formatUsd, percentChange } from '../format/money.ts';

export function EmployeeDetailPage() {
  // The :id part of the address, for example the 42 in /employees/42.
  const { id } = useParams();
  const detail = useEmployee(Number(id));
  const reference = useReference();
  useDocumentTitle(
    detail.data ? `${detail.data.employee.firstName} ${detail.data.employee.lastName}` : 'Employee',
  );
  // Which dialog is open, if any. One piece of state means two can never be open at once.
  const [openDialog, setOpenDialog] = useState<'salary' | 'details' | 'left' | null>(null);

  // After "Mark as left" the buttons that were pressed disappear. Keyboard focus would fall to the
  // page body, so it moves to the heading instead. (These hooks come before any early return.)
  const heading = useRef<HTMLHeadingElement>(null);
  const hadLeft = useRef(detail.data?.employee.status === 'left');
  const hasLeftNow = detail.data?.employee.status === 'left';
  useEffect(() => {
    if (hasLeftNow && !hadLeft.current) heading.current?.focus();
    hadLeft.current = hasLeftNow;
  }, [hasLeftNow]);

  if (detail.isPending) {
    return <CircularProgress aria-label="Loading employee" />;
  }
  // An error replaces the page only when there is nothing to show. A failed refresh, for example
  // when the window is focused again, must not throw away what is on screen or close a dialog.
  if (!detail.data) {
    return (
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <BackLink />
        <Alert severity="error">{detail.error?.message ?? 'Something went wrong'}</Alert>
      </Stack>
    );
  }

  const { employee, salaryHistory } = detail.data;
  const hasLeft = employee.status === 'left';
  const countryName =
    reference.data?.countries.find((country) => country.code === employee.country)?.name ??
    employee.country;

  return (
    <Stack spacing={3}>
      <BackLink />

      {detail.isError && (
        <Alert severity="warning">
          The latest data could not be loaded. What is shown may be out of date.
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Typography variant="h5" component="h1" ref={heading} tabIndex={-1}>
          {employee.firstName} {employee.lastName}
        </Typography>
        <Chip
          size="small"
          label={hasLeft ? 'Left' : 'Active'}
          variant="outlined"
          sx={{ color: hasLeft ? 'text.secondary' : 'text.primary' }}
        />
        {!hasLeft && (
          <Stack direction="row" spacing={1} sx={{ ml: 'auto !important' }}>
            <Button variant="outlined" onClick={() => setOpenDialog('details')}>
              Edit details
            </Button>
            <Button variant="outlined" color="warning" onClick={() => setOpenDialog('left')}>
              Mark as left
            </Button>
          </Stack>
        )}
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        <Paper variant="outlined" sx={{ p: 3, flex: 2 }}>
          <Box
            component="dl"
            aria-label="Employee details"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' },
              rowGap: 1.5,
              m: 0,
            }}
          >
            <Fact label="Employee ID">{employee.employeeCode}</Fact>
            <Fact label="Email">{employee.email}</Fact>
            <Fact label="Job title">{employee.jobTitle}</Fact>
            <Fact label="Department">{employee.department}</Fact>
            <Fact label="Level">{employee.level}</Fact>
            <Fact label="Country">{countryName}</Fact>
            <Fact label="Hire date">{formatDate(employee.hireDate)}</Fact>
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, flex: 1 }}>
          <Typography variant="overline" color="text.secondary">
            Annual base salary
          </Typography>
          <Typography variant="h4" data-testid="current-salary">
            {formatMoney(employee.salaryMinor, employee.currency)}
          </Typography>
          {employee.currency !== 'USD' && (
            <Typography color="text.secondary">
              about {formatUsd(employee.salaryUsdMinor)} at fixed rates
            </Typography>
          )}
          <Box sx={{ mt: 2 }}>
            {hasLeft ? (
              <Typography color="text.secondary">
                Left on {employee.leftOn ? formatDate(employee.leftOn) : 'an unknown date'}. The
                salary can no longer be changed.
              </Typography>
            ) : (
              <Button variant="contained" onClick={() => setOpenDialog('salary')}>
                Change salary
              </Button>
            )}
          </Box>
        </Paper>
      </Stack>

      <Paper variant="outlined">
        <Typography variant="h6" component="h2" sx={{ p: 2 }}>
          Salary history
        </Typography>
        <TableContainer>
          <Table size="small" aria-label="Salary history">
            <TableHead>
              <TableRow>
                <TableCell>Effective date</TableCell>
                <TableCell align="right">Previous</TableCell>
                <TableCell align="right">New</TableCell>
                <TableCell align="right">Change</TableCell>
                <TableCell>Reason</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {salaryHistory.map((change) => (
                <TableRow key={change.id}>
                  <TableCell>{formatDate(change.effectiveDate)}</TableCell>
                  <TableCell align="right">
                    {change.previousMinor === null
                      ? ''
                      : formatMoney(change.previousMinor, change.currency)}
                  </TableCell>
                  <TableCell align="right">
                    {formatMoney(change.newMinor, change.currency)}
                  </TableCell>
                  <TableCell align="right">
                    {change.previousMinor === null
                      ? ''
                      : percentChange(change.previousMinor, change.newMinor)}
                  </TableCell>
                  <TableCell>{change.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Rendered only while open, so each opening starts with a fresh form. */}
      {openDialog === 'salary' && (
        <ChangeSalaryDialog employee={employee} onClose={() => setOpenDialog(null)} />
      )}
      {openDialog === 'details' && (
        <EditDetailsDialog employee={employee} onClose={() => setOpenDialog(null)} />
      )}
      {openDialog === 'left' && (
        <MarkAsLeftDialog employee={employee} onClose={() => setOpenDialog(null)} />
      )}
    </Stack>
  );
}

function BackLink() {
  return (
    <Link component={RouterLink} to={useBackToList()} underline="hover">
      Back to employees
    </Link>
  );
}

/** One label and value pair in the details list. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <Typography component="dt" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" sx={{ m: 0 }}>
        {children}
      </Typography>
    </>
  );
}
