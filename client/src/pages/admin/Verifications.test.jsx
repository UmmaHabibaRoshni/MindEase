import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// T8.9 - unit tests for the verification queue page (BL-8)

vi.mock('../../api/adminApi', () => ({
  getPendingUsers: vi.fn(),
  approveUser: vi.fn(),
  rejectUser: vi.fn(),
  readError: (err, fallback) => err?.response?.data?.message || fallback,
}));

const { getPendingUsers, approveUser, rejectUser } = await import('../../api/adminApi');
const { default: Verifications } = await import('./Verifications');

const pending = [
  { _id: 'u1', name: 'Test Volunteer', email: 'volunteer@test.com', role: 'volunteer', createdAt: '2026-10-01T00:00:00.000Z' },
  { _id: 'u2', name: 'Dr Rahman', email: 'psy@test.com', role: 'psychologist', createdAt: '2026-10-02T00:00:00.000Z' },
];

describe('Verifications page', () => {
  beforeEach(() => {
    getPendingUsers.mockReset().mockResolvedValue(pending);
    approveUser.mockReset().mockResolvedValue({});
    rejectUser.mockReset().mockResolvedValue({});
  });

  it('shows a loading state, then the pending accounts', async () => {
    render(<Verifications />);

    expect(screen.getByTestId('verifications-loading')).toBeInTheDocument();

    expect(await screen.findByText('Test Volunteer')).toBeInTheDocument();
    expect(screen.getByText('psy@test.com')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2
  });

  it('shows the empty state when nothing is pending', async () => {
    getPendingUsers.mockResolvedValue([]);

    render(<Verifications />);

    expect(await screen.findByTestId('verifications-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('verifications-table')).not.toBeInTheDocument();
  });

  it('surfaces a load failure', async () => {
    getPendingUsers.mockRejectedValue(new Error('boom'));

    render(<Verifications />);

    expect(await screen.findByTestId('verifications-error')).toHaveTextContent(
      'Could not load pending accounts.'
    );
  });

  it('approves an account and drops the row', async () => {
    render(<Verifications />);
    await screen.findByText('Test Volunteer');

    await userEvent.click(screen.getAllByRole('button', { name: 'Approve' })[0]);

    expect(approveUser).toHaveBeenCalledWith('u1');
    await waitFor(() => expect(screen.queryByText('Test Volunteer')).not.toBeInTheDocument());
    expect(screen.getByTestId('verifications-notice')).toHaveTextContent('Test Volunteer was approved.');
    expect(screen.getByText('Dr Rahman')).toBeInTheDocument();
  });

  it('requires a reason before rejecting', async () => {
    render(<Verifications />);
    await screen.findByText('Test Volunteer');

    await userEvent.click(screen.getAllByRole('button', { name: 'Reject' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(rejectUser).not.toHaveBeenCalled();
    expect(screen.getByTestId('verifications-error')).toHaveTextContent(
      'A rejection reason is required.'
    );
    expect(screen.getByText('Test Volunteer')).toBeInTheDocument();
  });

  it('rejects an account with the typed reason', async () => {
    render(<Verifications />);
    await screen.findByText('Test Volunteer');

    await userEvent.click(screen.getAllByRole('button', { name: 'Reject' })[0]);
    await userEvent.type(screen.getByLabelText('Rejection reason'), 'ID not verifiable');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(rejectUser).toHaveBeenCalledWith('u1', 'ID not verifiable');
    await waitFor(() => expect(screen.queryByText('Test Volunteer')).not.toBeInTheDocument());
    expect(screen.getByTestId('verifications-notice')).toHaveTextContent('Test Volunteer was rejected.');
  });

  it('closes the reason box on cancel without calling the API', async () => {
    render(<Verifications />);
    await screen.findByText('Test Volunteer');

    await userEvent.click(screen.getAllByRole('button', { name: 'Reject' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText('Rejection reason')).not.toBeInTheDocument();
    expect(rejectUser).not.toHaveBeenCalled();
  });

  it('keeps the row and shows the server message when approve fails', async () => {
    approveUser.mockRejectedValue({
      response: { data: { message: 'This account is already approved.' } },
    });

    render(<Verifications />);
    await screen.findByText('Test Volunteer');

    await userEvent.click(screen.getAllByRole('button', { name: 'Approve' })[0]);

    expect(await screen.findByTestId('verifications-error')).toHaveTextContent(
      'This account is already approved.'
    );
    expect(screen.getByText('Test Volunteer')).toBeInTheDocument();
  });
});
