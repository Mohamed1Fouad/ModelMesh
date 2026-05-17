"use client";

import { Badge } from "@/components/ui/badge";

const CAPABILITY_GROUPS = [
  {
    label: "Core",
    items: [
      { id: "chat", label: "Chat" },
      { id: "completion", label: "Completion" },
      { id: "streaming", label: "Streaming" },
    ],
  },
  {
    label: "Vision",
    items: [
      { id: "vision", label: "Vision" },
      { id: "multimodal", label: "Multimodal" },
      { id: "image_generation", label: "Image Generation" },
    ],
  },
  {
    label: "Tools",
    items: [
      { id: "tool_use", label: "Tool Use" },
      { id: "function_calling", label: "Function Calling" },
    ],
  },
  {
    label: "Specialized",
    items: [
      { id: "reasoning", label: "Reasoning" },
      { id: "code", label: "Code" },
      { id: "embeddings", label: "Embeddings" },
    ],
  },
  {
    label: "Output",
    items: [
      { id: "json_mode", label: "JSON Mode" },
    ],
  },
];

const ALL_CAPABILITIES = CAPABILITY_GROUPS.flatMap((g) => g.items.map((i) => i.id));

interface CapabilitySelectorProps {
  name: string;
  defaultValue?: string[];
}

export function CapabilitySelector({ name, defaultValue = [] }: CapabilitySelectorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Capabilities</span>
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={(e) => {
            const container = (e.target as HTMLElement).closest(".capability-selector");
            if (!container) return;
            const checkboxes = container.querySelectorAll<HTMLInputElement>("input[type='checkbox']");
            const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
            checkboxes.forEach((cb) => {
              cb.checked = !allChecked;
            });
          }}
        >
          Toggle All
        </button>
      </div>

      <div className="capability-selector grid grid-cols-2 gap-4">
        {CAPABILITY_GROUPS.map((group) => (
          <div key={group.label} className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {group.label}
            </span>
            <div className="space-y-2">
              {group.items.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground transition-colors"
                >
                  <input
                    type="checkbox"
                    name={name}
                    value={item.id}
                    defaultChecked={defaultValue.includes(item.id)}
                    className="rounded border-input h-4 w-4"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {ALL_CAPABILITIES.map((cap) => (
          <Badge key={cap} variant="outline" className="text-[10px]">
            {cap}
          </Badge>
        ))}
        <span className="text-[10px] text-muted-foreground ml-1">— all supported capabilities</span>
      </div>
    </div>
  );
}
