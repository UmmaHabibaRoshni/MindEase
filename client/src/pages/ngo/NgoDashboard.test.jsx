import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import NgoDashboard from './NgoDashboard';
import { getMyReferrals } from '../../api/ngoApi';

// T14.9 - unit tests for the NGO referral dashboard (T14.7)

vi.mock('../../api/ngoApi', () => ({
  getMyReferrals: vi.fn(),
  readError: (err, fallback) => err?.response?.data?.message || fallback,
}));

vi.mock('../../components/common/StatusBadge', async () => {
  const React = await import('react');
  return {
    default: ({ status }) =>
      React.createElement('span', { 'data-testid': 'status-badge' }, status),
  };
});

const makeReferrals = () => [
  {
    _id: 'r1',
    status: 'pending',
    createdAt: '2026-10-12T09:30:00.000Z',
    request: {
      category: 'Mental health',
      urgency: 'high',
      description: 'Seeker needs counselling support.',
    },
  },
  {
    _id: 'r2',
    status: 'in_progress',
    createdAt: '2026-10-10T14:00:00.000Z',
    request: {
      category: 'Legal aid',
      urgency: 'medium',
      description: 'Seeker is asking for help with a legal issue.',
    },
  },
  {
    _id: 'r3',
    status: 'resolved',
    createdAt: '2026-10-05T11:15:00.000Z',
    request: {
      category: 'Shelter',
      urgency: 'low',
      description: 'Seeker needed shelter information.',
    },
  },
];

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <NgoDashboard />
    </MemoryRouter>
  );

describe('NgoDashboard', () => {
  beforeEach(() => {
    getMyReferrals.mockReset();
    getMyReferrals.mockResolvedValue(makeReferrals());
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a loading message while the referrals are being fetched', () => {
    getMyReferrals.mockReturnValue(new Promise(() => {}));

    renderDashboard();

    expect(screen.getByText('Loading...')).not.toBeNull();
  });

  it('fetches the referrals once', async () => {
    renderDashboard();

    await screen.findByText('Seeker needs counselling support.');

    expect(getMyReferrals).toHaveBeenCalledTimes(1);
  });

  it('lists every referral with its category, urgency and description', async () => {
    renderDashboard();

    expect(await screen.findByText('Seeker needs counselling support.')).not.toBeNull();
    expect(screen.getByText('Seeker is asking for help with a legal issue.')).not.toBeNull();
    expect(screen.getByText('Seeker needed shelter information.')).not.toBeNull();
    expect(screen.getByText('Mental health')).not.toBeNull();
    expect(screen.getByText('Legal aid')).not.toBeNull();
    expect(screen.getByText('Shelter')).not.toBeNull();
  });

  it('shows the status of each referral', async () => {
    renderDashboard();

    await screen.findByText('Seeker needs counselling support.');

    const badges = screen.getAllByTestId('status-badge').map((b) => b.textContent);
    expect(badges).toEqual(['pending', 'in_progress', 'resolved']);
  });

  it('links each referral to its detail page', async () => {
    renderDashboard();

    await screen.findByText('Seeker needs counselling support.');

    const links = screen.getAllByRole('link', { name: /open/i });
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/dashboard/ngo/referrals/r1',
      '/dashboard/ngo/referrals/r2',
      '/dashboard/ngo/referrals/r3',
    ]);
  });

  it('shows an empty message when there are no referrals', async () => {
    getMyReferrals.mockResolvedValue([]);

    renderDashboard();

    expect(await screen.findByText('No referred cases yet.')).not.toBeNull();
  });

  describe('status filter', () => {
    it('starts on All and offers every status', async () => {
      renderDashboard();

      await screen.findByText('Seeker needs counselling support.');

      const select = screen.getByLabelText(/filter by status/i);
      expect(select.value).toBe('all');

      const values = Array.from(select.querySelectorAll('option')).map((o) => o.value);
      expect(values).toEqual(['all', 'pending', 'in_progress', 'resolved', 'closed']);
    });

    it('shows only the referrals with the chosen status', async () => {
      const user = userEvent.setup();
      renderDashboard();

      await screen.findByText('Seeker needs counselling support.');
      await user.selectOptions(screen.getByLabelText(/filter by status/i), 'in_progress');

      expect(screen.getByText('Seeker is asking for help with a legal issue.')).not.toBeNull();
      expect(screen.queryByText('Seeker needs counselling support.')).toBeNull();
      expect(screen.queryByText('Seeker needed shelter information.')).toBeNull();
    });

    it('says so when no referral has the chosen status', async () => {
      const user = userEvent.setup();
      renderDashboard();

      await screen.findByText('Seeker needs counselling support.');
      await user.selectOptions(screen.getByLabelText(/filter by status/i), 'closed');

      expect(screen.getByText('No referrals with this status.')).not.toBeNull();
      expect(screen.queryByText('No referred cases yet.')).toBeNull();
    });

    it('brings every referral back when All is chosen again', async () => {
      const user = userEvent.setup();
      renderDashboard();

      await screen.findByText('Seeker needs counselling support.');
      const select = screen.getByLabelText(/filter by status/i);
      await user.selectOptions(select, 'resolved');
      await user.selectOptions(select, 'all');

      expect(screen.getAllByTestId('status-badge')).toHaveLength(3);
    });
  });

  describe('when loading fails', () => {
    it('shows the message the server sent', async () => {
      getMyReferrals.mockRejectedValue({ response: { data: { message: 'Server is down.' } } });

      renderDashboard();

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toBe('Server is down.');
    });

    it('uses a fallback message when the server sent none', async () => {
      getMyReferrals.mockRejectedValue(new Error('Network Error'));

      renderDashboard();

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toBe('Could not load referrals.');
    });

    it('does not claim there are no referrals', async () => {
      getMyReferrals.mockRejectedValue(new Error('Network Error'));

      renderDashboard();

      await screen.findByRole('alert');
      expect(screen.queryByText('No referred cases yet.')).toBeNull();
    });
  });
});