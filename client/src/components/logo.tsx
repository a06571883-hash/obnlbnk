export default function Logo({ className = "", size = 40 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="50" cy="50" r="45" className="fill-primary" />
      <path
        d="M35 65V35L65 50L35 65Z"
        fill="currentColor"
        className="text-primary-foreground"
      />
      <circle
        cx="50"
        cy="50"
        r="45"
        className="stroke-primary-foreground"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}

export function LogoFull({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Logo />
      <span className="font-bold text-xl">OOOBNAL Bank</span>
    </div>
  );
}
