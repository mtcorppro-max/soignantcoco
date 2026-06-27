export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-as2coeur-trim.png" alt="AS2CŒUR" className="h-7 w-auto" />
    </span>
  );
}
