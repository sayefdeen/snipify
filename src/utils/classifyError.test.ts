import { classifyError } from './classifyError';

describe('classifyError', () => {
  describe('token-expired', () => {
    it('matches status 401', () => {
      expect(classifyError({ status: 401, message: 'Unauthorized' })).toEqual({ kind: 'token-expired' });
    });
    it('matches "401" in message', () => {
      expect(classifyError(new Error('Request failed with status 401'))).toEqual({ kind: 'token-expired' });
    });
    it('matches "unauthorized" (case-insensitive)', () => {
      expect(classifyError(new Error('Unauthorized'))).toEqual({ kind: 'token-expired' });
    });
  });

  describe('scope', () => {
    it('matches 403 with "scope" in message', () => {
      expect(classifyError({ status: 403, message: 'Missing scope' })).toEqual({ kind: 'scope' });
    });
    it('matches 403 with "permission" in message', () => {
      expect(classifyError({ status: 403, message: 'Insufficient permission' })).toEqual({ kind: 'scope' });
    });
    it('does not match 403 without scope/permission in message', () => {
      expect(classifyError({ status: 403, message: 'Forbidden' })).toEqual({ kind: 'rate-limit', resetAt: undefined });
    });
  });

  describe('rate-limit', () => {
    it('matches status 403 without scope mention', () => {
      expect(classifyError({ status: 403, message: 'Forbidden' })).toEqual({ kind: 'rate-limit', resetAt: undefined });
    });
    it('matches "rate limit" in message', () => {
      expect(classifyError(new Error('API rate limit exceeded'))).toEqual({ kind: 'rate-limit', resetAt: undefined });
    });
    it('matches "429" in message', () => {
      expect(classifyError(new Error('status 429'))).toEqual({ kind: 'rate-limit', resetAt: undefined });
    });
    it('propagates resetAt', () => {
      const ts = Date.now() + 60_000;
      expect(classifyError({ status: 403, message: 'rate limit', resetAt: ts })).toEqual({ kind: 'rate-limit', resetAt: ts });
    });
  });

  describe('unreachable', () => {
    it('returns unreachable for generic network errors', () => {
      expect(classifyError(new Error('Failed to fetch'))).toEqual({ kind: 'unreachable' });
    });
    it('returns unreachable for null', () => {
      expect(classifyError(null)).toEqual({ kind: 'unreachable' });
    });
    it('returns unreachable for undefined', () => {
      expect(classifyError(undefined)).toEqual({ kind: 'unreachable' });
    });
  });
});
