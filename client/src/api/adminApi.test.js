import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

// T8.9 - unit tests for the admin API client (BL-8)

const get = vi.fn();
const patch = vi.fn();
const interceptorUse = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get,
      patch,
      interceptors: { request: { use: interceptorUse } },
    })),
  },
}));

const { getPendingUsers, approveUser, rejectUser, readError } = await import('./adminApi');

// Captured at import time: the global afterEach clears mock history, and the
// module only configures axios once.
const createArgs = axios.create.mock.calls[0];
const [onRequest] = interceptorUse.mock.calls[0];

describe('adminApi', () => {
  beforeEach(() => {
    get.mockReset();
    patch.mockReset();
  });

  it('is created against the admin route prefix', () => {
    expect(createArgs).toEqual([{ baseURL: '/api/admin' }]);
  });

  describe('auth interceptor', () => {
    const runInterceptor = (config = { headers: {} }) => onRequest(config);

    it('attaches the bearer token when one is stored', () => {
      localStorage.setItem('token', 'abc123');

      expect(runInterceptor().headers.Authorization).toBe('Bearer abc123');
    });

    it('leaves the header off when there is no token', () => {
      expect(runInterceptor().headers.Authorization).toBeUndefined();
    });
  });

  describe('getPendingUsers', () => {
    it('unwraps the users array', async () => {
      get.mockResolvedValue({ data: { users: [{ _id: '1', name: 'Dana' }] } });

      await expect(getPendingUsers()).resolves.toEqual([{ _id: '1', name: 'Dana' }]);
      expect(get).toHaveBeenCalledWith('/pending-users');
    });

    it('falls back to an empty array when the key is missing', async () => {
      get.mockResolvedValue({ data: {} });

      await expect(getPendingUsers()).resolves.toEqual([]);
    });
  });

  describe('approveUser', () => {
    it('patches the approve route and returns the user', async () => {
      patch.mockResolvedValue({ data: { user: { _id: '7', status: 'approved' } } });

      await expect(approveUser('7')).resolves.toEqual({ _id: '7', status: 'approved' });
      expect(patch).toHaveBeenCalledWith('/users/7/approve');
    });
  });

  describe('rejectUser', () => {
    it('sends the trimmed reason in the body', async () => {
      patch.mockResolvedValue({ data: { user: { _id: '7', status: 'rejected' } } });

      await rejectUser('7', '  not verifiable  ');

      expect(patch).toHaveBeenCalledWith('/users/7/reject', { reason: 'not verifiable' });
    });

    // The backend 400s on an empty reason, so fail before the request goes out.
    it.each(['', '   ', undefined])('refuses to send the reason %o', async (badReason) => {
      await expect(rejectUser('7', badReason)).rejects.toThrow('A rejection reason is required.');
      expect(patch).not.toHaveBeenCalled();
    });
  });

  describe('readError', () => {
    it('prefers the message the server sent', () => {
      const err = { response: { data: { message: 'This account is already approved.' } } };

      expect(readError(err)).toBe('This account is already approved.');
    });

    it('uses the fallback when there is no server message', () => {
      expect(readError(new Error('Network Error'), 'Could not load.')).toBe('Could not load.');
    });
  });
});
