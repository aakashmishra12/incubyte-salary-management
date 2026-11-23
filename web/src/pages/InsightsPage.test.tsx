import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OutlierPage, PayBreakdown, PayOverview } from '../api/types.ts';
import { App } from '../App.tsx';
import { reference } from '../testing/fixtures.ts';
import { renderPage, stubApi } from '../testing/render.tsx';

const overview: PayOverview = {
  headcount: 9_598,
  totalUsdMinor: 651_024_049_00,
  countries: [
    {
      country: 'US',
      currency: 'USD',
      headcount: 2_848,
      totalLocalMinor: 300_000_000_00,
      totalUsdMinor: 300_000_000_00,
    },
    {
      country: 'JP',
      currency: 'JPY',
      headcount: 479,
      totalLocalMinor: 5_000_000_000,
      totalUsdMinor: 33_500_000_00,
    },
  ],
  ratesAsOf: '2026-11-01',
};

const byCountry: PayBreakdown = {
  groupBy: 'country',
  groups: [
    {
      key: 'JP',
      usd: { count: 479, min: 30_000_00, median: 60_300_00, mean: 62_000_00, max: 150_000_00 },
      local: {
        currency: 'JPY',
        count: 479,
        min: 4_500_000,
        median: 9_000_000,
        mean: 9_250_000,
        max: 22_400_000,
      },
    },
  ],
  ratesAsOf: '2026-11-01',
};

const byLevel: PayBreakdown = {
  groupBy: 'level',
  groups: [
    {
      key: 'L3',
      usd: { count: 2_400, min: 20_000_00, median: 71_000_00, mean: 74_000_00, max: 190_000_00 },
      local: null,
    },
  ],
  ratesAsOf: '2026-11-01',
};

const outliers: OutlierPage = {
  items: [
    {
      id: 42,
      employeeCode: 'E00042',
      firstName: 'Kenji',
      lastName: 'Sato',
      country: 'JP',
      department: 'Engineering',
      level: 'L3',
      currency: 'JPY',
      salaryMinor: 6_300_000,
      direction: 'below',
      compaRatio: 0.7,
      peerMedianMinor: 9_000_000,
      peerCount: 35,
    },
  ],
  total: 254,
  page: 1,
  pageSize: 25,
  rule: { minPeers: 5, lowPercent: 80, highPercent: 120 },
  coverage: { rated: 9_414, unrated: 184 },
};

function openInsights(handlers: Parameters<typeof stubApi>[0] = {}) {
  const requests = stubApi({
    'GET /api/reference': () => reference,
    'GET /api/insights/overview': () => overview,
    'GET /api/insights/breakdown': (url) =>
      url.searchParams.get('groupBy') === 'level' ? byLevel : byCountry,
    'GET /api/insights/outliers': () => outliers,
    ...handlers,
  });
  renderPage(<App />, { route: '/insights' });
  return requests;
}

const lastRequestTo = (requests: ReturnType<typeof stubApi>, path: string) =>
  requests.filter((request) => request.url.pathname === path).at(-1)!.url.searchParams;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('InsightsPage', () => {
  it('is reachable from the navigation', async () => {
    stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees': () => ({ items: [], total: 0, page: 1, pageSize: 25 }),
      'GET /api/insights/overview': () => overview,
      'GET /api/insights/breakdown': () => byCountry,
      'GET /api/insights/outliers': () => outliers,
    });
    renderPage(<App />);

    await userEvent.click(screen.getByRole('link', { name: 'Insights' }));

    expect(await screen.findByRole('heading', { name: 'Insights' })).toBeInTheDocument();
  });

  describe('overview', () => {
    it('shows the headcount and the total annual cost', async () => {
      openInsights();
      const section = within(await screen.findByRole('region', { name: 'Overview' }));

      expect(await section.findByText('9,598')).toBeInTheDocument();
      expect(section.getByText('$651,024,049')).toBeInTheDocument();
    });

    it('shows each country with its cost in local currency and in USD', async () => {
      openInsights();
      const section = within(await screen.findByRole('region', { name: 'Overview' }));

      const japan = (await section.findByText('Japan')).closest('tr')!;
      expect(japan).toHaveTextContent('479');
      expect(japan).toHaveTextContent('¥5,000,000,000');
      expect(japan).toHaveTextContent('$33,500,000');
    });

    it('says the USD figures are approximate and gives the rate date', async () => {
      openInsights();

      expect(
        await screen.findByText(/USD figures use fixed exchange rates dated 1 Nov 2026/),
      ).toBeInTheDocument();
    });
  });

  describe('breakdown', () => {
    it('shows a group in its own currency when it has one, with the USD median beside it', async () => {
      openInsights();
      const section = within(await screen.findByRole('region', { name: 'Breakdown' }));

      const japan = (await section.findByText('Japan')).closest('tr')!;
      expect(japan).toHaveTextContent('¥4,500,000');
      expect(japan).toHaveTextContent('¥9,000,000');
      expect(japan).toHaveTextContent('¥22,400,000');
      expect(japan).toHaveTextContent('$60,300');
    });

    it('asks for another grouping, and shows mixed-currency groups in USD', async () => {
      const requests = openInsights();
      const section = within(await screen.findByRole('region', { name: 'Breakdown' }));

      await userEvent.click(section.getByLabelText('Group by'));
      await userEvent.click(await screen.findByRole('option', { name: 'Level' }));

      const level = (await section.findByText('L3')).closest('tr')!;
      expect(level).toHaveTextContent('$20,000');
      expect(level).toHaveTextContent('$190,000');
      expect(lastRequestTo(requests, '/api/insights/breakdown').get('groupBy')).toBe('level');
    });

    it('narrows to a department when I choose one', async () => {
      const requests = openInsights();
      const section = within(await screen.findByRole('region', { name: 'Breakdown' }));
      await section.findByText('Japan');

      await userEvent.click(section.getByLabelText('Department'));
      await userEvent.click(await screen.findByRole('option', { name: 'Engineering' }));

      await vi.waitFor(() =>
        expect(lastRequestTo(requests, '/api/insights/breakdown').get('department')).toBe(
          'Engineering',
        ),
      );
    });

    it('says "no data" when no employee matches', async () => {
      openInsights({
        'GET /api/insights/breakdown': () => ({ ...byCountry, groups: [] }),
      });
      const section = within(await screen.findByRole('region', { name: 'Breakdown' }));

      expect(await section.findByText('No data for this combination.')).toBeInTheDocument();
    });
  });

  describe('outliers', () => {
    it('explains each flag: salary, peer median, compa-ratio and number of peers', async () => {
      openInsights();
      const section = within(await screen.findByRole('region', { name: 'Pay outliers' }));

      const row = (await section.findByRole('link', { name: 'Kenji Sato' })).closest('tr')!;
      expect(row).toHaveTextContent('¥6,300,000');
      expect(row).toHaveTextContent('¥9,000,000');
      expect(row).toHaveTextContent('0.70');
      expect(row).toHaveTextContent('35');
      expect(row).toHaveTextContent('Below');
    });

    it('states the rule and how many employees could not be rated', async () => {
      openInsights();
      const section = within(await screen.findByRole('region', { name: 'Pay outliers' }));

      expect(await section.findByText(/below 80% or above 120%/)).toBeInTheDocument();
      expect(section.getByText(/184 employees could not be rated/)).toBeInTheDocument();
      expect(section.getByText(/fewer than 5/)).toBeInTheDocument();
    });

    it('shows only one direction when I ask', async () => {
      const requests = openInsights();
      const section = within(await screen.findByRole('region', { name: 'Pay outliers' }));
      await section.findByRole('link', { name: 'Kenji Sato' });

      await userEvent.click(section.getByLabelText('Direction'));
      await userEvent.click(await screen.findByRole('option', { name: 'Below peers' }));

      await vi.waitFor(() =>
        expect(lastRequestTo(requests, '/api/insights/outliers').get('direction')).toBe('below'),
      );
    });

    it('says so when nobody is flagged', async () => {
      openInsights({
        'GET /api/insights/outliers': () => ({ ...outliers, items: [], total: 0 }),
      });
      const section = within(await screen.findByRole('region', { name: 'Pay outliers' }));

      expect(await section.findByText('Nobody is outside the range.')).toBeInTheDocument();
    });
  });

  it('says so when an insight cannot be loaded', async () => {
    openInsights({ 'GET /api/insights/overview': () => new Response('{}', { status: 500 }) });

    expect(await screen.findByText('The overview could not be loaded.')).toBeInTheDocument();
  });
});
