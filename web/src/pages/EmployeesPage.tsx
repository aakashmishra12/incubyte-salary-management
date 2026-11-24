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
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useLocation, useSearchParams } from 'react-router';
import { ApiError } from '../api/client.ts';
import { useEmployees, useReference } from '../api/queries.ts';
import { formatDate } from '../format/date.ts';
import { formatMoney, formatUsd } from '../format/money.ts';

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZES = [10, 25, 50, 100];
const SEARCH_DELAY_MS = 300;

const SORTS = ['name', 'employeeCode', 'hireDate', 'country', 'department', 'level', 'salary'];

/** A whole number from 1 up to `max`, or undefined if the text is anything else. */
function wholeNumber(text: string | null, max = Infinity): number | undefined {
  if (text === null || !/^\d+$/.test(text)) return undefined;
  const value = Number(text);
  return value >= 1 && value <= max ? value : undefined;
}

/**
 * The address can be typed or bookmarked by anyone, so what is sent to the server is checked first.
 * A page of -4 or a page size of "abc" is simply left out, and the filters are passed on as they are
 * (the server checks them, and the page says so if it refuses).
 */
function paramsForServer(params: URLSearchParams): URLSearchParams {
  const clean = new URLSearchParams();
  for (const name of ['search', 'country', 'department', 'level', 'status']) {
    const value = params.get(name);
    if (value) clean.set(name, value);
  }
  const sort = params.get('sort');
  if (sort && SORTS.includes(sort)) clean.set('sort', sort);
  const order = params.get('order');
  if (order === 'asc' || order === 'desc') clean.set('order', order);
  const page = wholeNumber(params.get('page'));
  if (page) clean.set('page', String(page));
  const pageSize = wholeNumber(params.get('pageSize'), 100);
  if (pageSize) clean.set('pageSize', String(pageSize));
  return clean;
}

/** The columns of the table. `sort` is the name the API knows the column by, when sortable. */
const COLUMNS: { label: string; sort?: string; align?: 'right' }[] = [
  { label: 'Employee ID', sort: 'employeeCode' },
  { label: 'Name', sort: 'name' },
  { label: 'Job title' },
  { label: 'Department', sort: 'department' },
  { label: 'Level', sort: 'level' },
  { label: 'Country', sort: 'country' },
  { label: 'Hired', sort: 'hireDate' },
  { label: 'Status' },
  { label: 'Salary', sort: 'salary', align: 'right' },
];

export function EmployeesPage() {
  // The filters live in the address bar (?country=IN&page=2), not in component state.
  // That makes a view bookmarkable, and the back button undoes a filter.
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const serverParams = paramsForServer(params);
  const employees = useEmployees(serverParams);
  const reference = useReference();

  const sort = serverParams.get('sort') ?? 'name';
  const order = serverParams.get('order') ?? 'asc';
  const page = Number(serverParams.get('page') ?? 1);
  const pageSize = Number(serverParams.get('pageSize') ?? DEFAULT_PAGE_SIZE);

  /**
   * Changes filters in the address bar. Any change except paging goes back to page 1.
   * It builds on the address as it is at that moment (the function form), not on the address
   * as it was when this page last drew, so two changes close together cannot undo each other.
   */
  const update = useCallback(
    (changes: Record<string, string>, keepPage = false) => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        for (const [name, value] of Object.entries(changes)) {
          if (value) next.set(name, value);
          else next.delete(name);
        }
        if (!keepPage) next.delete('page');
        return next;
      });
    },
    [setParams],
  );

  // The search box updates as you type, but the request waits until you pause,
  // so typing "sharma" sends one request instead of six.
  const urlSearch = params.get('search') ?? '';
  const [searchText, setSearchText] = useState(urlSearch);
  // When the address changes by itself (the Back button, the Employees link), the box follows it.
  // React's advice for this is to adjust the state while drawing, not in an effect: remember which
  // address the box last matched, and when the address is different, take its search text.
  const [matchedUrlSearch, setMatchedUrlSearch] = useState(urlSearch);
  if (urlSearch !== matchedUrlSearch) {
    setMatchedUrlSearch(urlSearch);
    setSearchText(urlSearch);
  }
  useEffect(() => {
    if (searchText === urlSearch) return;
    const timer = setTimeout(() => update({ search: searchText }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchText, urlSearch, update]);

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
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h5" component="h1">
            Employees
          </Typography>
          <Typography color="text.secondary" aria-live="polite">
            {employees.data ? countLabel(employees.data.total) : ' '}
          </Typography>
        </Box>
        <Button
          variant="contained"
          component={RouterLink}
          to="/employees/new"
          state={{ from: `${location.pathname}${location.search}` }}
        >
          Add employee
        </Button>
      </Stack>

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

      {employees.isError &&
      employees.error instanceof ApiError &&
      employees.error.status === 400 ? (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={() => setParams(new URLSearchParams())}>
              Clear the filters
            </Button>
          }
        >
          Some of the filters in the address are not valid.
        </Alert>
      ) : (
        employees.isError && (
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
        )
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
                    <Link
                      component={RouterLink}
                      to={`/employees/${employee.id}`}
                      // So that "Back to employees" returns to this very view, filters and all.
                      state={{ from: `${location.pathname}${location.search}` }}
                      underline="hover"
                    >
                      {employee.firstName} {employee.lastName}
                    </Link>
                  </TableCell>
                  <TableCell>{employee.jobTitle}</TableCell>
                  <TableCell>{employee.department}</TableCell>
                  <TableCell>{employee.level}</TableCell>
                  <TableCell>{countryName(employee.country)}</TableCell>
                  <TableCell>{formatDate(employee.hireDate)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={employee.status === 'active' ? 'Active' : 'Left'}
                      variant="outlined"
                      sx={{
                        color: employee.status === 'active' ? 'text.primary' : 'text.disabled',
                      }}
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
                    {employees.data.total > 0 ? (
                      <Stack spacing={1} sx={{ alignItems: 'center' }}>
                        <span>
                          There is no page {page}. The last page is{' '}
                          {Math.ceil(employees.data.total / pageSize)}.
                        </span>
                        <Button size="small" onClick={() => update({ page: '' }, true)}>
                          Go to the first page
                        </Button>
                      </Stack>
                    ) : (
                      'No employees match these filters.'
                    )}
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
          rowsPerPageOptions={PAGE_SIZES}
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
