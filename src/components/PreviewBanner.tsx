export default function PreviewBanner() {
  if (import.meta.env.VITE_PLATFORM_MODE === 'live') return null;
  return (
    <div
      role="status"
      className="fixed bottom-0 inset-x-0 z-[10000] border-t border-amber-400/30 bg-[#17120a]/95 px-4 py-2 text-center text-[11px] font-medium text-amber-100 backdrop-blur-md"
    >
      Product preview — City Gate Capital is not operating as a bank in this environment. Balances and trading are demonstrations; deposits, custody, insurance, and live financial transactions are unavailable.
    </div>
  );
}
