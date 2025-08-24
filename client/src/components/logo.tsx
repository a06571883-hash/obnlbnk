export default function Logo({ className = "", size = 40 }: { className?: string; size?: number }) {
  return (
    <img
      src="/assets/logo.png"
      alt="BNAL Bank Logo"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      style={{ imageRendering: 'auto' }}
    />
  );
}

export function LogoFull({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Logo size={50} />
      <span className="sr-only">BNAL Bank</span>
    </div>
  );
}
