import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "muted" | "outline" | "secondary";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const variants = {
    default: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-400",
    warning: "bg-amber-500/10 text-amber-400",
    danger: "bg-red-500/10 text-red-400",
    muted: "bg-muted text-muted-foreground",
    outline: "border border-border text-foreground",
    secondary: "bg-secondary text-secondary-foreground",
  };

  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
}
