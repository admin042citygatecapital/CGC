// @vitest-environment jsdom
import { act, Suspense } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useClientHydrated } from '../lib/useClientHydrated';

afterEach(() => vi.unstubAllGlobals());

function ProtectedShell({ authenticated }: { authenticated: boolean }) {
  const hydrated = useClientHydrated();
  return hydrated && authenticated ? <h1>Sandbox KYC workspace</h1> : null;
}

describe('protected route hydration', () => {
  it('matches the empty server shell when authentication resolves before client hydration', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const container = document.createElement('div');
    // Fixed React-generated server markup is required to exercise hydration; no external input.
    // eslint-disable-next-line no-unsanitized/property
    container.innerHTML = renderToString(<Suspense fallback={null}><ProtectedShell authenticated={false} /></Suspense>);
    document.body.appendChild(container);
    const errors = vi.fn();
    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, <Suspense fallback={null}><ProtectedShell authenticated /></Suspense>, { onRecoverableError: errors });
      });
      expect(errors).not.toHaveBeenCalled();
      expect(container.textContent).toBe('Sandbox KYC workspace');
      await act(async () => { root!.render(<Suspense fallback={null}><ProtectedShell authenticated={false} /></Suspense>); });
      expect(container.textContent).toBe('');
    } finally {
      if (root) await act(async () => root!.unmount());
      container.remove();
    }
  });
  it('does not render protected content on the server even when session data is available', () => {
    expect(renderToString(<ProtectedShell authenticated />)).toBe('');
  });
});
