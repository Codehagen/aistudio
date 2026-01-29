/**
 * AI Provider Types
 *
 * Defines the available AI providers for image editing and video generation.
 */

export type AIProvider = "fal" | "xai";

export const DEFAULT_PROVIDER: AIProvider = "fal";

/**
 * Provider capabilities and limitations
 */
export const PROVIDER_CAPABILITIES = {
  fal: {
    name: "Fal.ai",
    description: "Default provider with full mask-based inpainting support",
    supportsMaskInpainting: true,
    supportsPromptOnlyEditing: true,
    supportsVideo: true,
    videoDurationRange: { min: 5, max: 10 },
    videoAspectRatios: ["16:9", "9:16", "1:1"] as const,
  },
  xai: {
    name: "xAI (Grok)",
    description: "Alternative provider with prompt-only editing",
    supportsMaskInpainting: false,
    supportsPromptOnlyEditing: true,
    supportsVideo: true,
    videoDurationRange: { min: 1, max: 15 },
    videoAspectRatios: [
      "16:9",
      "4:3",
      "1:1",
      "9:16",
      "3:4",
      "3:2",
      "2:3",
    ] as const,
  },
} as const;

export type ProviderCapabilities =
  (typeof PROVIDER_CAPABILITIES)[keyof typeof PROVIDER_CAPABILITIES];
