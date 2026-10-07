
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// T10.9 - unit tests for the volunteer Availability component (BL-10)

vi.mock('../api/volunteerApi', () => ({
  getMyAvailability: vi.fn(),
  updateAvailability: vi.fn(),
  readError: (err, fallback) => err?.response?.data?.message || fallback,
}));

const { getMyAvailability, updateAvailability } = await import('../api/volunteerApi');
const { default: Availability } = await import('./Availability');

const emptyRecord = {
  isAvailable: false,
  dayOfWeek: null,
  startTime: null,
  endTime: null,
};

const savedRecord = {
  isAvailable: true,
  dayOfWeek: 'Monday',
  startTime: '09:00',
  endTime: '17:00',
};

async function renderLoaded() {
  render(<Availability />);
  await screen.findByText('Your availability');
}

function fillWindow(day, from, to) {
  fireEvent.change(screen.getByLabelText(/^day:/i), { target: { value: day } });
  fireEvent.change(screen.getByLabelText(/^from:/i), { target: { value: from } });
  fireEvent.change(screen.getByLabelText(/^to:/i), { target: { value: to } });
}

describe('Availability component', () => {
  beforeEach(() => {
    getMyAvailability.mockReset().mockResolvedValue(emptyRecord);
    updateAvailability.mockReset().mockResolvedValue(savedRecord);
  });

  it('shows a loading state, then the form', async () => {
    render(<Availability />);

    expect(screen.getByText('Loading your availability...')).toBeInTheDocument();
    expect(await screen.findByText('Your availability')).toBeInTheDocument();
    expect(screen.queryByText('Loading your availability...')).not.toBeInTheDocument();
  });

  it('starts as Not available when the volunteer has no record yet', async () => {
    await renderLoaded();

    expect(screen.getByText('Not available')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByLabelText(/^day:/i)).toHaveValue('');
  });

  it('fills the form from the saved availability', async () => {
    getMyAvailability.mockResolvedValue(savedRecord);

    await renderLoaded();

    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByLabelText(/^day:/i)).toHaveValue('Monday');
    expect(screen.getByLabelText(/^from:/i)).toHaveValue('09:00');
    expect(screen.getByLabelText(/^to:/i)).toHaveValue('17:00');
  });

  it('lists all seven days to choose from', async () => {
    await renderLoaded();

    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual([
      'Choose a day',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
  });

  it('surfaces a load failure', async () => {
    getMyAvailability.mockRejectedValue(new Error('boom'));

    await renderLoaded();

    expect(screen.getByText('Could not load your availability.')).toBeInTheDocument();
  });

  it('blocks saving as available without a day and times', async () => {
    await renderLoaded();

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Save availability' }));

    expect(
      screen.getByText(
        'Choose a day, start time and end time before marking yourself available.'
      )
    ).toBeInTheDocument();
    expect(updateAvailability).not.toHaveBeenCalled();
  });

  it('blocks an end time that is not later than the start time', async () => {
    await renderLoaded();

    await userEvent.click(screen.getByRole('checkbox'));
    fillWindow('Monday', '17:00', '09:00');
    await userEvent.click(screen.getByRole('button', { name: 'Save availability' }));

    expect(screen.getByText('End time must be later than start time.')).toBeInTheDocument();
    expect(updateAvailability).not.toHaveBeenCalled();
  });

  it('saves a valid window and shows the Available status', async () => {
    await renderLoaded();

    await userEvent.click(screen.getByRole('checkbox'));
    fillWindow('Monday', '09:00', '17:00');
    await userEvent.click(screen.getByRole('button', { name: 'Save availability' }));

    expect(updateAvailability).toHaveBeenCalledWith({
      isAvailable: true,
      dayOfWeek: 'Monday',
      startTime: '09:00',
      endTime: '17:00',
    });
    expect(await screen.findByText('Availability saved.')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('lets a volunteer switch to not available without a window', async () => {
    getMyAvailability.mockResolvedValue(savedRecord);
    updateAvailability.mockResolvedValue({ ...savedRecord, isAvailable: false });

    await renderLoaded();

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Save availability' }));

    await waitFor(() =>
      expect(updateAvailability).toHaveBeenCalledWith(
        expect.objectContaining({ isAvailable: false })
      )
    );
    expect(await screen.findByText('Availability saved.')).toBeInTheDocument();
    expect(screen.getByText('Not available')).toBeInTheDocument();
  });

  it('disables the button while saving', async () => {
    let finishSave;
    updateAvailability.mockReturnValue(
      new Promise((resolve) => {
        finishSave = resolve;
      })
    );

    await renderLoaded();

    await userEvent.click(screen.getByRole('checkbox'));
    fillWindow('Monday', '09:00', '17:00');
    await userEvent.click(screen.getByRole('button', { name: 'Save availability' }));

    expect(await screen.findByRole('button', { name: 'Saving...' })).toBeDisabled();

    finishSave(savedRecord);
    expect(await screen.findByText('Availability saved.')).toBeInTheDocument();
  });

  it('shows the server message when saving fails', async () => {
    updateAvailability.mockRejectedValue({
      response: { data: { message: 'endTime must be later than startTime.' } },
    });

    await renderLoaded();

    await userEvent.click(screen.getByRole('checkbox'));
    fillWindow('Monday', '09:00', '17:00');
    await userEvent.click(screen.getByRole('button', { name: 'Save availability' }));

    expect(
      await screen.findByText('endTime must be later than startTime.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Availability saved.')).not.toBeInTheDocument();
  });
});