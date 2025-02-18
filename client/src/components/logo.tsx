export default function Logo({ className = "", size = 40 }: { className?: string; size?: number }) {
  return (
    <img
      src="/attached_assets/Picsart_25-02-11_01-44-02-638.png"
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
      <span className="font-bold text-xl">OOOBNAL Bank</span>
    </div>
  );
}