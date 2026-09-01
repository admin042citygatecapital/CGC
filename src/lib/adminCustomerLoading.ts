export function customerCountSummary({ loading, error, total }: {
  loading: boolean;
  error: string | null;
  total: number;
}) {
  if (loading) return 'Loading customer records…';
  if (error) return 'Customer records unavailable';
  return `${total.toLocaleString()} total customer${total === 1 ? '' : 's'}`;
}
