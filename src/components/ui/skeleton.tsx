import { cn } from "@/lib/utils";

/**
 * shadcn/ui Skeleton — https://ui.shadcn.com/docs/components/base/skeleton
 *
 * Same API as the upstream component; the surface is bound to this site's
 * palette instead of shadcn's `bg-accent`, since the design tokens here are the
 * `--d-*` custom properties.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-[var(--d-bg-raise)]", className)}
      {...props}
    />
  );
}

export { Skeleton };
