/** AidReady mark: a home with a check, on the ink tile. */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="6.5" fill="#0b0d12" />
      <path d="M5.5 11.4 12 5.6l6.5 5.8V18a.9.9 0 0 1-.9.9H6.4a.9.9 0 0 1-.9-.9z" fill="#5b8cff" />
      <path d="m8.9 13.3 2.2 2.2 4.1-4.3" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
