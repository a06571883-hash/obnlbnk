export default function Logo({ className = "", size = 40 }: { className?: string; size?: number }) {
  return (
    <img
      src="/assets/logo.png"
      alt="OOOBNAL Bank Logo"
      width={size}
      height={size}
      className={className}
    />
  );
}

export function LogoFull({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Logo size={50} />
      <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-foreground">
        OOOBNAL Bank
      </span>
    </div>
  );
}