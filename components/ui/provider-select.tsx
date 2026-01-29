"use client";

import { IconBolt, IconSparkles } from "@tabler/icons-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type AIProvider, PROVIDER_CAPABILITIES } from "@/lib/providers/types";
import { cn } from "@/lib/utils";

interface ProviderSelectProps {
  value: AIProvider;
  onChange: (provider: AIProvider) => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default";
}

export function ProviderSelect({
  value,
  onChange,
  disabled,
  className,
  size = "default",
}: ProviderSelectProps) {
  return (
    <Select
      disabled={disabled}
      onValueChange={(v) => onChange(v as AIProvider)}
      value={value}
    >
      <SelectTrigger className={cn("w-[140px]", className)} size={size}>
        <SelectValue placeholder="Select provider" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="fal">
          <div className="flex items-center gap-2">
            <IconSparkles className="h-4 w-4 text-purple-500" />
            <span>{PROVIDER_CAPABILITIES.fal.name}</span>
          </div>
        </SelectItem>
        <SelectItem value="xai">
          <div className="flex items-center gap-2">
            <IconBolt className="h-4 w-4 text-blue-500" />
            <span>{PROVIDER_CAPABILITIES.xai.name}</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

interface ProviderInfoProps {
  provider: AIProvider;
  className?: string;
}

export function ProviderInfo({ provider, className }: ProviderInfoProps) {
  const capabilities = PROVIDER_CAPABILITIES[provider];

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/30 p-3 text-muted-foreground text-sm",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {provider === "fal" ? (
          <IconSparkles className="h-4 w-4 text-purple-500" />
        ) : (
          <IconBolt className="h-4 w-4 text-blue-500" />
        )}
        <span className="font-medium text-foreground">{capabilities.name}</span>
      </div>
      <p className="mt-1.5">{capabilities.description}</p>
      {!capabilities.supportsMaskInpainting && (
        <p className="mt-2 text-amber-500 text-xs">
          Note: This provider uses prompt-only editing (no mask support)
        </p>
      )}
    </div>
  );
}
