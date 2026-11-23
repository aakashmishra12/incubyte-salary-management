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
import { useState, type ReactNode } from 'react';
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
  // Which dialog is open, if any. One piece of state means two can never be open at once.
  const [openDialog, setOpenDialog] = useState<'salary' | 'details' | 'left' | null>(null);

  if (detail.isPending) {
    return <CircularProgress aria-label="Loading employee" />;
  }
  if (detail.isError) {
    return (
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <BackLink />
        <Alert severity="error">{detail.error.message}</Alert>
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

      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Typography variant="h5" component="h1">
          {employee.firstName} {employee.lastName}
        </Typography>
        <Chip
          size="small"
          label={hasLeft ? 'Left' : 'Active'}
          variant="outlined"
          sx={{ color: hasLeft ? 'text.disabled' : 'text.primary' }}
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
    <Link component={RouterLink} to="/" underline="hover">
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
