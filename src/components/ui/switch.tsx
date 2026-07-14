import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "inline-flex h-5 w-8.5 shrink-0 items-center rounded-full border border-transparent bg-muted p-0.5 shadow-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-checked:bg-primary data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="block size-3.5 rounded-full bg-background shadow-panel ring-1 ring-border/60 transition-transform data-checked:translate-x-3.5 data-checked:ring-0"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
