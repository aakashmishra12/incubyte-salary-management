import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Link,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { useEmployees, useReference } from '../api/queries.ts';
import { formatMoney, formatUsd } from '../format/money.ts';

const DEFAULT_PAGE_SIZE = 25;
const SEARCH_DELAY_MS = 300;

/** The columns of the table. `sort` is the name the API knows the column by, when sortable. */
const COLUMNS: { label: string; sort?: string; align?: 'right' }[] = [
  { label: 'Employee ID', sort: 'employeeCode' },
  { label: 'Name', sort: 'name' },
  { label: 'Job title' },
  { label: 'Department', sort: 'department' },
  { label: 'Level', sort: 'level' },
  { label: 'Country', sort: 'country' },
  { label: 'Status' },
  { label: 'Salary', sort: 'salary', align: 'right' },
];

export function EmployeesPage() {
  // The filters live in the address bar (?country=IN&page=2), not in component state.
  // That makes a view bookmarkable, and the back button undoes a filter.
  const [params, setParams] = useSearchParams();
  const employees = useEmployees(params);
  const reference = useReference();

  const sort = params.get('sort') ?? 'name';
  const order = params.get('order') ?? 'asc';
  const page = Number(params.get('page') ?? 1);
  const pageSize = Number(params.get('pageSize') ?? DEFAULT_PAGE_SIZE);

  /** Changes filters in the address bar. Any change except paging goes back to page 1. */
  function update(changes: Record<string, string>, keepPage = false) {
    const next = new URLSearchParams(params);
    for (const [name, value] of Object.entries(changes)) {
      if (value) next.set(name, value);
      else next.delete(name);
    }
    if (!keepPage) next.delete('page');
    setParams(next);
  }

  // The search box updates as you type, but the request waits until you pause,
  // so typing "sharma" sends one request instead of six.
  const [searchText, setSearchText] = useState(params.get('search') ?? '');
  useEffect(() => {
    if (searchText === (params.get('search') ?? '')) return;
    const timer = setTimeout(() => update({ search: searchText }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
    // Only re-run when the text changes. `update` is recreated on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  function sortBy(column: string) {
    if (sort === column) {
      update({ sort: column, order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      // The first click on salary shows the highest paid. Other columns start from A.
      update({ sort: column, order: column === 'salary' ? 'desc' : 'asc' });
    }
  }

  const countryName = (code: string) =>
    reference.data?.countries.find((country) => country.code === code)?.name ?? code;

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5" component="h1">
          Employees
        </Typography>
        <Typography color="text.secondary" aria-live="polite">
          {employees.data ? countLabel(employees.data.total) : ' '}
        </Typography>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField
          label="Search"
          placeholder="Name, email or employee ID"
          size="small"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          sx={{ minWidth: 260 }}
        />
        <FilterSelect
          label="Country"
          value={params.get('country') ?? ''}
          onChange={(country) => update({ country })}
          options={reference.data?.countries.map((c) => ({ value: c.code, label: c.name }))}
        />
        <FilterSelect
          label="Department"
          value={params.get('department') ?? ''}
          onChange={(department) => update({ department })}
          options={reference.data?.departments.map((d) => ({ value: d, label: d }))}
        />
        <FilterSelect
          label="Level"
          value={params.get('level') ?? ''}
          onChange={(level) => update({ level })}
          options={reference.data?.levels.map((l) => ({ value: l, label: l }))}
        />
        <FilterSelect
          label="Status"
          value={params.get('status') ?? ''}
          onChange={(status) => update({ status })}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'left', label: 'Left' },
          ]}
        />
      </Stack>

      {employees.isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => employees.refetch()}>
              Try again
            </Button>
          }
        >
          The employee list could not be loaded.
        </Alert>
      )}

      <Paper variant="outlined">
        {/* Holds its height so the table does not jump when the bar appears. */}
        <Box sx={{ height: 4 }}>{employees.isFetching && <LinearProgress />}</Box>
        <TableContainer>
          <Table size="small" aria-label="Employees">
            <TableHead>
              <TableRow>
                {COLUMNS.map((column) => (
                  <TableCell
                    key={column.label}
                    align={column.align}
                    sortDirection={sort === column.sort ? (order as 'asc' | 'desc') : false}
                  >
                    {column.sort ? (
                      <TableSortLabel
                        active={sort === column.sort}
                        direction={sort === column.sort ? (order as 'asc' | 'desc') : 'asc'}
                        onClick={() => sortBy(column.sort!)}
                      >
                        {column.label}
                      </TableSortLabel>
                    ) : (
                      column.label
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.data?.items.map((employee) => (
                <TableRow key={employee.id} hover>
                  <TableCell>{employee.employeeCode}</TableCell>
                  <TableCell>
                    <Link component={RouterLink} to={`/employees/${employee.id}`} underline="hover">
                      {employee.firstName} {employee.lastName}
                    </Link>
                  </TableCell>
                  <TableCell>{employee.jobTitle}</TableCell>
                  <TableCell>{employee.department}</TableCell>
                  <TableCell>{employee.level}</TableCell>
                  <TableCell>{countryName(employee.country)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={employee.status === 'active' ? 'Active' : 'Left'}
                      color={employee.status === 'active' ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {formatMoney(employee.salaryMinor, employee.currency)}
                    </Typography>
                    {employee.currency !== 'USD' && (
                      <Typography variant="caption" color="text.secondary">
                        about {formatUsd(employee.salaryUsdMinor)}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {employees.data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 6 }}>
                    No employees match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={employees.data?.total ?? 0}
          // The API counts pages from 1. This component counts from 0.
          page={employees.data ? page - 1 : 0}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[10, 25, 50, 100]}
          onPageChange={(_event, newPage) =>
            update({ page: newPage === 0 ? '' : String(newPage + 1) }, true)
          }
          onRowsPerPageChange={(event) => update({ pageSize: event.target.value })}
        />
      </Paper>
    </Stack>
  );
}

function countLabel(total: number): string {
  const formatted = total.toLocaleString('en-US');
  return total === 1 ? '1 employee' : `${formatted} employees`;
}

/** A dropdown with an "All" choice. Choosing "All" clears the filter. */
function FilterSelect(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[] | undefined;
}) {
  const options = props.options ?? [];
  // Until the options have loaded, show "All" even if the address names a value,
  // because a dropdown cannot show a value that is not in its list.
  const value = options.some((option) => option.value === props.value) ? props.value : '';

  return (
    <TextField
      select
      label={props.label}
      size="small"
      value={value}
      onChange={(event) => props.onChange(event.target.value)}
      sx={{ minWidth: 160 }}
    >
      <MenuItem value="">All</MenuItem>
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
