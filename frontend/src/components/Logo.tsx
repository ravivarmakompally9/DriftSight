export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <circle cx="16" cy="16" r="15" fill="#0E3A45" />
      <path d="M5 19c3-2 5-2 8 0s5 2 8 0 4-2 6-1" stroke="#5AD6D6" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="20" cy="11" r="3.2" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="20" cy="11" r="0.9" fill="#fff" />
      <path d="M10 12l4 1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="1 2" />
    </svg>
  );
}

export function Wordmark({ className = "text-[23px]" }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold leading-none tracking-tight text-white ${className}`}>
      Drift<span className="text-[#5AD6D6]">Sight</span>
    </span>
  );
}
