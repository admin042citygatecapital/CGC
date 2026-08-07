import { useEffect, useState, type ReactNode } from 'react';

interface ClientOnlyProps {
  children: ReactNode;
}

/**
 * Defers browser-only UI until after React has hydrated the server markup.
 * The server and the client's first render therefore remain identical.
 */
export default function ClientOnly({ children }: ClientOnlyProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted ? children : null;
}
