export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="CSD Handshake"
    >
      <rect
        x="2.5"
        y="10"
        width="18"
        height="12"
        rx="6"
        stroke="currentColor"
        strokeWidth="2.25"
        fill="none"
      />
      <rect
        x="11.5"
        y="10"
        width="18"
        height="12"
        rx="6"
        stroke="currentColor"
        strokeWidth="2.25"
        fill="none"
      />
    </svg>
  );
}
