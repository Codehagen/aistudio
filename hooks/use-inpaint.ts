"use client";

import { useCallback, useState } from "react";
import { triggerInpaintTask } from "@/lib/actions";
import type { AIProvider } from "@/lib/providers/types";

type EditMode = "remove" | "add";

interface UseInpaintReturn {
  inpaint: (
    imageId: string,
    maskDataUrl: string | undefined,
    prompt: string,
    mode: EditMode,
    replaceNewerVersions?: boolean,
    provider?: AIProvider
  ) => Promise<{ success: boolean; runId?: string; newImageId?: string }>;
  isProcessing: boolean;
  error: string | null;
  runId: string | null;
  reset: () => void;
}

export function useInpaint(): UseInpaintReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  const reset = useCallback(() => {
    setIsProcessing(false);
    setError(null);
    setRunId(null);
  }, []);

  const inpaint = useCallback(
    async (
      imageId: string,
      maskDataUrl: string | undefined,
      prompt: string,
      mode: EditMode,
      replaceNewerVersions = false,
      provider: AIProvider = "fal"
    ): Promise<{ success: boolean; runId?: string; newImageId?: string }> => {
      if (!(imageId && prompt)) {
        setError("Missing required fields");
        return { success: false };
      }

      // Mask is required for Fal.ai provider only
      if (provider === "fal" && !maskDataUrl) {
        setError("Mask is required for Fal.ai provider");
        return { success: false };
      }

      setIsProcessing(true);
      setError(null);
      setRunId(null);

      try {
        const result = await triggerInpaintTask(
          imageId,
          prompt,
          mode,
          maskDataUrl,
          replaceNewerVersions,
          provider
        );

        if (!result.success) {
          throw new Error(result.error || "Inpainting failed");
        }

        setRunId(result.data.runId);
        // Keep isProcessing true - the task is running in the background
        // The component should use the runId to track progress
        return {
          success: true,
          runId: result.data.runId,
          newImageId: result.data.newImageId,
        };
      } catch (err) {
        console.error("Inpaint error:", err);
        setError(err instanceof Error ? err.message : "Inpainting failed");
        setIsProcessing(false);
        return { success: false };
      }
    },
    []
  );

  return {
    inpaint,
    isProcessing,
    error,
    runId,
    reset,
  };
}
