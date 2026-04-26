import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", {
  variants: {
    variant: {
      default: "bg-secondary text-secondary-foreground",
      outline: "border border-border bg-card text-card-foreground",
      success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
      warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      danger: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
