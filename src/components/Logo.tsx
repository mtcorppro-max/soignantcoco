export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-white">
        ❤
      </span>
      <span className="text-brand">
        Soignant<span className="text-rose-400">Coco</span>
      </span>
    </span>
  );
}
