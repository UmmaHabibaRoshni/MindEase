import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ReferralDetail from './ReferralDetail';
import { getReferral, updateReferralStatus } from '../../api/ngoApi';

// T14.9 - unit tests for the NGO referral detail page (T14.8)

vi.mock('../../api/ngoApi', () => ({
  getReferral: vi.fn(),
  updateReferralStatus: vi.fn(),
  readError: (err, fallback) => err?.response?.data?.message || fallback,
}));

vi.mock('../../components/common/StatusBadge', async () => {
  const React = await import('react');
  return {
    default: ({ status }) =>
      React.createElement('span', { 'data-testid': 'status-badge' }, status),
  };
});

const makeReferral = (overrides = {}) => ({
  _id: 'r1',
  status: 'pending',
  note: '',
  createdAt: '2026-10-12T09:30:00.000Z',
  request: {
    category: 'Mental health',
    urgency: 'high',
    description: 'Seeker needs counselling support.',
  },
  ...overrides,
});

const renderPage = (id = 'r1') =>
  render(
    <MemoryRouter initialEntries={[`/dashboard/ngo/referrals/${id}`]}>
      <Routes>
        <Route path="/dashboard/ngo/referrals/:id" element={<ReferralDetail />} />
      </Routes>
    </MemoryRouter>
  );

const waitForPage = () => screen.findByText('Seeker needs counselling support.');

describe('ReferralDetail', () => {
  beforeEach(() => {
    getReferral.mockReset();
    updateReferralStatus.mockReset();
    getReferral.mockResolvedValue(makeReferral());
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a loading message while the referral is being fetched', () => {
    getReferral.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText('Loading...')).not.toBeNull();
  });

  it('fetches the referral named in the URL', async () => {
    renderPage('r1');

    await waitForPage();

    expect(getReferral).toHaveBeenCalledWith('r1');
  });

  it('shows the referral details', async () => {
    renderPage();

    await waitForPage();

    expect(screen.getByText('Mental health')).not.toBeNull();
    expect(screen.getByText('high')).not.toBeNull();
    expect(screen.getByTestId('status-badge').textContent).toBe('pending');
  });

  it('links back to the referred cases list', async () => {
    renderPage();

    await waitForPage();

    const link = screen.getByRole('link', { name: /back to referred cases/i });
    expect(link.getAttribute('href')).toBe('/dashboard/ngo');
  });

  it('starts with the current status selected and offers all four', async () => {
    getReferral.mockResolvedValue(makeReferral({ status: 'in_progress' }));

    renderPage();

    await waitForPage();

    const select = screen.getByLabelText(/update status/i);
    expect(select.value).toBe('in_progress');

    const labels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(labels).toEqual(['pending', 'in progress', 'resolved', 'closed']);
  });

  it('fills the note box with the existing note', async () => {
    getReferral.mockResolvedValue(makeReferral({ note: 'Case opened.' }));

    renderPage();

    await waitForPage();

    expect(screen.getByLabelText(/note/i).value).toBe('Case opened.');
  });

  it('counts the characters typed in the note', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitForPage();
    expect(screen.getByText('0/1000')).not.toBeNull();

    await user.type(screen.getByLabelText(/note/i), 'abc');

    expect(screen.getByText('3/1000')).not.toBeNull();
  });

  describe('saving', () => {
    it('keeps Save disabled while nothing has changed', async () => {
      renderPage();

      await waitForPage();

      expect(screen.getByRole('button', { name: /save/i }).disabled).toBe(true);
    });

    it('enables Save once the status changes', async () => {
      const user = userEvent.setup();
      renderPage();

      await waitForPage();
      await user.selectOptions(screen.getByLabelText(/update status/i), 'in_progress');

      expect(screen.getByRole('button', { name: /save/i }).disabled).toBe(false);
    });

    it('enables Save once a note is typed', async () => {
      const user = userEvent.setup();
      renderPage();

      await waitForPage();
      await user.type(screen.getByLabelText(/note/i), 'Called her.');

      expect(screen.getByRole('button', { name: /save/i }).disabled).toBe(false);
    });

    it('sends the new status and note, then confirms', async () => {
      const user = userEvent.setup();
      updateReferralStatus.mockResolvedValue(
        makeReferral({ status: 'in_progress', note: 'We contacted her.' })
      );
      renderPage();

      await waitForPage();
      await user.selectOptions(screen.getByLabelText(/update status/i), 'in_progress');
      await user.type(screen.getByLabelText(/note/i), 'We contacted her.');
      await user.click(screen.getByRole('button', { name: /save/i }));

      expect(await screen.findByText('Referral updated.')).not.toBeNull();
      expect(updateReferralStatus).toHaveBeenCalledWith('r1', {
        status: 'in_progress',
        note: 'We contacted her.',
      });
    });

    it('shows the saved status and disables Save again afterwards', async () => {
      const user = userEvent.setup();
      updateReferralStatus.mockResolvedValue(makeReferral({ status: 'resolved' }));
      renderPage();

      await waitForPage();
      await user.selectOptions(screen.getByLabelText(/update status/i), 'resolved');
      await user.click(screen.getByRole('button', { name: /save/i }));

      await screen.findByText('Referral updated.');
      expect(screen.getByTestId('status-badge').textContent).toBe('resolved');
      expect(screen.getByRole('button', { name: /save/i }).disabled).toBe(true);
    });

    it('disables the form and shows Saving... while the request runs', async () => {
      const user = userEvent.setup();
      let finishSave;
      updateReferralStatus.mockReturnValue(
        new Promise((resolve) => {
          finishSave = resolve;
        })
      );
      renderPage();

      await waitForPage();
      await user.selectOptions(screen.getByLabelText(/update status/i), 'closed');
      await user.click(screen.getByRole('button', { name: /save/i }));

      const savingButton = await screen.findByRole('button', { name: /saving/i });
      expect(savingButton.disabled).toBe(true);
      expect(screen.getByLabelText(/update status/i).disabled).toBe(true);
      expect(screen.getByLabelText(/note/i).disabled).toBe(true);

      await act(async () => {
        finishSave(makeReferral({ status: 'closed' }));
      });

      expect(await screen.findByText('Referral updated.')).not.toBeNull();
    });

    it('shows the server message when saving fails', async () => {
      const user = userEvent.setup();
      updateReferralStatus.mockRejectedValue({
        response: { data: { message: 'That note is too long.' } },
      });
      renderPage();

      await waitForPage();
      await user.selectOptions(screen.getByLabelText(/update status/i), 'in_progress');
      await user.click(screen.getByRole('button', { name: /save/i }));

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toBe('That note is too long.');
      expect(screen.queryByText('Referral updated.')).toBeNull();
    });

    it('uses a fallback message when saving fails without a server message', async () => {
      const user = userEvent.setup();
      updateReferralStatus.mockRejectedValue(new Error('Network Error'));
      renderPage();

      await waitForPage();
      await user.selectOptions(screen.getByLabelText(/update status/i), 'in_progress');
      await user.click(screen.getByRole('button', { name: /save/i }));

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toBe('Could not update this referral.');
    });
  });

  describe('when loading fails', () => {
    it('shows the error and no form', async () => {
      getReferral.mockRejectedValue({ response: { data: { message: 'Referral not found.' } } });

      renderPage();

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toBe('Referral not found.');
      expect(screen.queryByLabelText(/update status/i)).toBeNull();
      expect(screen.queryByRole('button', { name: /save/i })).toBeNull();
    });

    it('uses a fallback message when the server sent none', async () => {
      getReferral.mockRejectedValue(new Error('Network Error'));

      renderPage();

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toBe('Could not load this referral.');
    });
  });
});