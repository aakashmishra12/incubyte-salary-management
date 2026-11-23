import {
  Alert,
  Box,
  Chip,
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
  TextField,
  Typography,
} from '@mui/material';
import { useId, useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import { useBreakdown, useOutliers, useOverview, useReference } from '../api/queries.ts';
import type { Reference } from '../api/types.ts';
import { formatDate } from '../format/date.ts';
import { formatMoney, formatUsd } from '../format/money.ts';

export function InsightsPage() {
  const reference = useReference();

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" component="h1">
          Insights
        </Typography>
        <Typography color="text.secondary">
          Active employees only. People who have left are not counted.
          {reference.data &&
            ` USD figures use fixed exchange rates dated ${formatDate(reference.data.ratesAsOf)} and are approximate.`}
        </Typography>
      </Box>

      <OverviewSection reference={reference.data} />
      <BreakdownSection reference={reference.data} />
      <OutliersSection reference={reference.data} />
    </Stack>
  );
}

/** F6: how many people we pay, what it costs, and where the money goes. */
function OverviewSection({ reference }: { reference: Reference | undefined }) {
  const overview = useOverview();

  return (
    <Section title="Overview">
      {overview.isError && <Alert severity="error">The overview could not be loaded.</Alert>}
      {overview.data && (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <Stat
              label="Active employees"
              value={overview.data.headcount.toLocaleString('en-US')}
            />
            <Stat
              label="Annual salary cost (USD, approximate)"
              value={formatUsd(overview.data.totalUsdMinor)}
            />
            <Stat label="Countries" value={String(overview.data.countries.length)} />
          </Stack>
          <TableContainer>
            <Table size="small" aria-label="Cost by country">
              <TableHead>
                <TableRow>
                  <TableCell>Country</TableCell>
                  <TableCell align="right">Employees</TableCell>
                  <TableCell align="right">Annual cost (local)</TableCell>
                  <TableCell align="right">Annual cost (USD)</TableCell>
                  <TableCell sx={{ width: '25%' }}>Share of cost</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {overview.data.countries.map((country) => {
                  const share = (country.totalUsdMinor / overview.data.totalUsdMinor) * 100;
                  return (
                    <TableRow key={country.country}>
                      <TableCell>{countryName(reference, country.country)}</TableCell>
                      <TableCell align="right">
                        {country.headcount.toLocaleString('en-US')}
                      </TableCell>
                      <TableCell align="right">
                        {formatMoney(country.totalLocalMinor, country.currency)}
                      </TableCell>
                      <TableCell align="right">{formatUsd(country.totalUsdMinor)}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          {/* A bar whose length is the share, so the eye can compare rows. */}
                          <Box sx={{ flex: 1, bgcolor: 'grey.200', borderRadius: 1, height: 8 }}>
                            <Box
                              sx={{
                                width: `${share}%`,
                                bgcolor: 'primary.main',
                                borderRadius: 1,
                                height: 8,
                              }}
                            />
                          </Box>
                          <Typography variant="caption" sx={{ width: 44, textAlign: 'right' }}>
                            {share.toFixed(1)}%
                          </Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Section>
  );
}

/** F7: what a group typically earns and how wide the spread is. */
function BreakdownSection({ reference }: { reference: Reference | undefined }) {
  const [params, setParams] = useState({
    groupBy: 'country',
    country: '',
    department: '',
    level: '',
  });
  const breakdown = useBreakdown(params);
  const set = (name: keyof typeof params) => (value: string) =>
    setParams({ ...params, [name]: value });

  const groupLabel = (key: string) =>
    breakdown.data?.groupBy === 'country' ? countryName(reference, key) : key;

  return (
    <Section title="Breakdown">
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <Choice
          label="Group by"
          value={params.groupBy}
          onChange={set('groupBy')}
          options={[
            { value: 'country', label: 'Country' },
            { value: 'department', label: 'Department' },
            { value: 'level', label: 'Level' },
          ]}
        />
        <Choice
          label="Country"
          value={params.country}
          onChange={set('country')}
          all
          options={countryOptions(reference)}
        />
        <Choice
          label="Department"
          value={params.department}
          onChange={set('department')}
          all
          options={plainOptions(reference?.departments)}
        />
        <Choice
          label="Level"
          value={params.level}
          onChange={set('level')}
          all
          options={plainOptions(reference?.levels)}
        />
      </Stack>

      {breakdown.isError && <Alert severity="error">The breakdown could not be loaded.</Alert>}
      {breakdown.data && (
        <TableContainer>
          <Table size="small" aria-label="Salary breakdown">
            <TableHead>
              <TableRow>
                <TableCell>Group</TableCell>
                <TableCell align="right">Employees</TableCell>
                <TableCell align="right">Lowest</TableCell>
                <TableCell align="right">Median</TableCell>
                <TableCell align="right">Average</TableCell>
                <TableCell align="right">Highest</TableCell>
                <TableCell align="right">Median in USD</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {breakdown.data.groups.map((group) => {
                // Local currency when the whole group shares one, otherwise USD.
                const figures = group.local ?? { ...group.usd, currency: 'USD' };
                const money = (amount: number) => formatMoney(amount, figures.currency);
                return (
                  <TableRow key={group.key}>
                    <TableCell>{groupLabel(group.key)}</TableCell>
                    <TableCell align="right">{figures.count.toLocaleString('en-US')}</TableCell>
                    <TableCell align="right">{money(figures.min)}</TableCell>
                    <TableCell align="right">{money(figures.median)}</TableCell>
                    <TableCell align="right">{money(figures.mean)}</TableCell>
                    <TableCell align="right">{money(figures.max)}</TableCell>
                    <TableCell align="right">{formatUsd(group.usd.median)}</TableCell>
                  </TableRow>
                );
              })}
              {breakdown.data.groups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    No data for this combination.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        A group is shown in its own currency when everyone in it is paid in that currency. A group
        that mixes currencies is shown in USD.
      </Typography>
    </Section>
  );
}

/** F8: who is paid far above or below people doing the same job in the same place. */
function OutliersSection({ reference }: { reference: Reference | undefined }) {
  const [params, setParams] = useState({
    direction: '',
    country: '',
    department: '',
    page: 1,
    pageSize: 10,
  });
  const outliers = useOutliers(params);
  // Changing a filter goes back to the first page.
  const set = (name: 'direction' | 'country' | 'department') => (value: string) =>
    setParams({ ...params, [name]: value, page: 1 });

  const rule = outliers.data?.rule;
  const unrated = outliers.data?.coverage.unrated ?? 0;

  return (
    <Section title="Pay outliers">
      {rule && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Employees paid below {rule.lowPercent}% or above {rule.highPercent}% of the median for
          their peers: people in the same country, department and level. A flag is a prompt to look,
          not a verdict.
          {unrated > 0 &&
            ` ${unrated.toLocaleString('en-US')} employees could not be rated because their peer group has fewer than ${rule.minPeers} people.`}
        </Typography>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <Choice
          label="Direction"
          value={params.direction}
          onChange={set('direction')}
          all
          options={[
            { value: 'below', label: 'Below peers' },
            { value: 'above', label: 'Above peers' },
          ]}
        />
        <Choice
          label="Country"
          value={params.country}
          onChange={set('country')}
          all
          options={countryOptions(reference)}
        />
        <Choice
          label="Department"
          value={params.department}
          onChange={set('department')}
          all
          options={plainOptions(reference?.departments)}
        />
      </Stack>

      {outliers.isError && <Alert severity="error">The outliers could not be loaded.</Alert>}
      {outliers.data && (
        <>
          <TableContainer>
            <Table size="small" aria-label="Pay outliers">
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Country</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Level</TableCell>
                  <TableCell align="right">Salary</TableCell>
                  <TableCell align="right">Peer median</TableCell>
                  <TableCell align="right">Compa-ratio</TableCell>
                  <TableCell align="right">Peers</TableCell>
                  <TableCell>Flag</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {outliers.data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link component={RouterLink} to={`/employees/${item.id}`} underline="hover">
                        {item.firstName} {item.lastName}
                      </Link>
                    </TableCell>
                    <TableCell>{countryName(reference, item.country)}</TableCell>
                    <TableCell>{item.department}</TableCell>
                    <TableCell>{item.level}</TableCell>
                    <TableCell align="right">
                      {formatMoney(item.salaryMinor, item.currency)}
                    </TableCell>
                    <TableCell align="right">
                      {formatMoney(item.peerMedianMinor, item.currency)}
                    </TableCell>
                    <TableCell align="right">{item.compaRatio.toFixed(2)}</TableCell>
                    <TableCell align="right">{item.peerCount}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={item.direction === 'below' ? 'Below' : 'Above'}
                        color={item.direction === 'below' ? 'warning' : 'info'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {outliers.data.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      Nobody is outside the range.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={outliers.data.total}
            page={params.page - 1}
            rowsPerPage={params.pageSize}
            rowsPerPageOptions={[10, 25, 50]}
            onPageChange={(_event, newPage) => setParams({ ...params, page: newPage + 1 })}
            onRowsPerPageChange={(event) =>
              setParams({ ...params, pageSize: Number(event.target.value), page: 1 })
            }
          />
        </>
      )}
    </Section>
  );
}

/** A titled panel. The heading names the region, so screen readers can jump between insights. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <Paper variant="outlined" component="section" aria-labelledby={headingId} sx={{ p: 2 }}>
      <Typography variant="h6" component="h2" id={headingId} sx={{ mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4">{value}</Typography>
    </Paper>
  );
}

/** A dropdown. With `all`, it offers an "All" choice that clears the filter. */
function Choice(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  all?: boolean;
}) {
  return (
    <TextField
      select
      size="small"
      label={props.label}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
      sx={{ minWidth: 180 }}
    >
      {props.all && <MenuItem value="">All</MenuItem>}
      {props.options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

function countryName(reference: Reference | undefined, code: string): string {
  return reference?.countries.find((country) => country.code === code)?.name ?? code;
}

function countryOptions(reference: Reference | undefined) {
  return (reference?.countries ?? []).map((c) => ({ value: c.code, label: c.name }));
}

function plainOptions(values: string[] | undefined) {
  return (values ?? []).map((value) => ({ value, label: value }));
}
