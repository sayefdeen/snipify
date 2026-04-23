import { ErrorKind } from '../ui/SidebarViewProvider';

export function classifyError(err: unknown): { kind: ErrorKind; resetAt?: number } {
  const msg = (err as Error)?.message ?? '';
  const status = (err as { status?: number })?.status;
  if (status === 401 || msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
    return { kind: 'token-expired' };
  }
  if (status === 403 && (msg.includes('scope') || msg.toLowerCase().includes('permission'))) {
    return { kind: 'scope' };
  }
  if (status === 403 || msg.includes('rate limit') || msg.includes('429')) {
    const resetAt = (err as { resetAt?: number })?.resetAt;
    return { kind: 'rate-limit', resetAt };
  }
  return { kind: 'unreachable' };
}
