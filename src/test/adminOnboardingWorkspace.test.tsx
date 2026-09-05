// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ admin: { id: 'reviewer-1', role: 'SUPER_ADMIN' }, adminFetch: vi.fn() }));
vi.mock('@/lib/adminAuth', () => ({ useAdminAuth: () => ({ admin: auth.admin }), authHeaders: () => ({}), adminFetch: auth.adminFetch }));
vi.mock('@/layouts/AdminLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/admin/SumsubReadinessPanel', () => ({ default: () => null }));
vi.mock('@dr.pogodin/react-helmet', () => ({ Helmet: ({ children }: { children: ReactNode }) => <>{children}</> }));
import AdminOnboardingPage from '@/pages/admin/onboarding';

const cases = Array.from({ length: 23 }, (_, index) => {
  const suffix = String(index + 1).padStart(2, '0');
  return { id: `case-${suffix}`, userId: `usr-${suffix}`, caseType: 'individual', status: index === 0 ? 'needs_info' : 'submitted', version: 2, submittedBy: 'applicant', lastEditedBy: 'maker', updatedAt: `2026-09-${suffix}T10:00:00.000Z`, intakePosition: index + 1 };
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function bundle(id: string) {
  return {
    case: cases.find(item => item.id === id), evidence: [], documents: [], profile: null, customer: null,
    providerVerifications: { events: [], checks: { identityAccepted: false, kybAccepted: false, screeningClear: false } },
    events: [
      { id: 'event-old', action: 'case_submitted', actorId: 'applicant', createdAt: '2026-09-01T10:00:00.000Z', fromStatus: 'draft', toStatus: 'submitted' },
      { id: 'event-new', action: 'review_started', actorId: 'reviewer-2', createdAt: '2026-09-02T10:00:00.000Z', fromStatus: 'submitted', toStatus: 'under_review' },
    ],
  };
}
let deferredCase: { id: string; response: Promise<Response> } | null;

beforeEach(() => {
  auth.adminFetch.mockReset();
  deferredCase = null;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'https://example.test');
    if (url.pathname === '/api/admin/onboarding') {
      const id = url.searchParams.get('caseId');
      if (id && deferredCase?.id === id) return deferredCase.response;
      return json(id ? bundle(id) : { data: cases, controls: [], programme: null, sumsub: null });
    }
    if (['/api/admin/onboarding/screening', '/api/admin/onboarding/monitoring', '/api/admin/onboarding/compliance-cases'].includes(url.pathname)) return json({ data: [] });
    throw new Error(`Unexpected request: ${url.pathname}`);
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function openWorkspace() {
  render(<AdminOnboardingPage />);
  await screen.findByRole('searchbox', { name: 'Search cases' });
}
async function selectCase(id = '23') {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^usr-${id}`) }));
  await screen.findByRole('heading', { name: `Case case-${id}` });
}

describe('onboarding workspace presentation and decision safety', () => {
  it('filters, sorts and paginates loaded cases without sending mutations', async () => {
    await openWorkspace();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search cases' }), { target: { value: 'case-01' } });
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^usr-01/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Case status' }), { target: { value: 'approved' } });
    expect(screen.getByText(/No cases match these filters/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort cases' }), { target: { value: 'oldest' } });
    const caseButtons = screen.getAllByRole('button', { name: /usr-\d+/ });
    expect(caseButtons[0]).toHaveTextContent('usr-01');
    expect(auth.adminFetch).not.toHaveBeenCalled();
  });

  it('shows server history newest first with actor and transition details', async () => {
    await openWorkspace(); await selectCase();
    const history = within(screen.getByRole('region', { name: 'Case activity history' }));
    const events = history.getAllByRole('listitem');
    expect(events[0]).toHaveTextContent('review started');
    expect(events[0]).toHaveTextContent('submitted to under review');
    expect(events[0]).toHaveTextContent('Actor: reviewer-2');
    expect(events[1]).toHaveTextContent('case submitted');
  });

  it('discards a delayed detail response after a newer case is selected', async () => {
    let resolveOld!: (response: Response) => void;
    deferredCase = { id: 'case-23', response: new Promise<Response>(resolve => { resolveOld = resolve; }) };
    await openWorkspace();
    fireEvent.click(screen.getByRole('button', { name: /^usr-23/ }));
    await selectCase('22');
    await act(async () => { resolveOld(json(bundle('case-23'))); });
    expect(screen.getByRole('heading', { name: 'Case case-22' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Case case-23' })).not.toBeInTheDocument();
  });

  it('requires a rationale and sends no decision when confirmation is cancelled', async () => {
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await openWorkspace(); await selectCase();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.getByRole('alert')).toHaveTextContent('between 10 and 1,000 characters');
    expect(confirmation).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText(/Required review rationale/), { target: { value: 'Evidence reviewed for this test case.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('case-23'));
    expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('Version: 2'));
    expect(auth.adminFetch).not.toHaveBeenCalled();
  });

  it('preserves version checks and exposes a conflict without retrying a decision', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    auth.adminFetch.mockResolvedValueOnce(json({ error: 'WORKFLOW_CONFLICT' }, 409));
    await openWorkspace(); await selectCase();
    fireEvent.change(screen.getByPlaceholderText(/Required review rationale/), { target: { value: 'Evidence reviewed for this test case.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('changed while you were reviewing'));
    expect(auth.adminFetch).toHaveBeenCalledTimes(1);
    const [url, options] = auth.adminFetch.mock.calls[0];
    expect(url).toBe('/api/admin/onboarding/review');
    expect(JSON.parse(options.body)).toMatchObject({ caseId: 'case-23', expectedVersion: 2, decision: 'approved' });
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
  });

  it('clears the busy state and reports an uncertain outcome on network failure', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    auth.adminFetch.mockRejectedValueOnce(new Error('offline'));
    await openWorkspace(); await selectCase();
    fireEvent.change(screen.getByPlaceholderText(/Required review rationale/), { target: { value: 'Evidence reviewed for this test case.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('could not be confirmed'));
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
    expect(auth.adminFetch).toHaveBeenCalledTimes(1);
  });
});
