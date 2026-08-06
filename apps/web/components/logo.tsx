import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-emerald-400 text-white font-bold text-sm">
        H
      </div>
      <span className="text-base font-semibold tracking-tight">
        Hydra<span className="text-violet-400">Web</span>
      </span>
    </div>
  );
}
