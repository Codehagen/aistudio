"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import * as React from "react";
import type {
  MusicTrack,
  VideoAspectRatio,
  VideoRoomType,
} from "@/lib/db/schema";
import type { AIProvider } from "@/lib/providers/types";
import {
  autoSequenceClips,
  reindexSequenceOrders,
} from "@/lib/video/room-sequence";
import { VIDEO_DEFAULTS, VIDEO_LIMITS } from "@/lib/video/video-constants";
import { getVideoTemplateById } from "@/lib/video/video-templates";

export type VideoCreationStep =
  | "select-template"
  | "storyboard"
  | "select-images"
  | "assign-rooms"
  | "select-music"
  | "review";

export interface VideoImageItem {
  id: string;
  url: string;
  imageGenerationId?: string | null;
  startImageUrl: string;
  startImageId: string;
  startImageGenerationId?: string | null;
  endImageUrl: string;
  endImageId: string;
  endImageGenerationId?: string | null;
  roomType: VideoRoomType;
  roomLabel: string;
  sequenceOrder: number;
  transitionType?: "cut" | "seamless";
}

export interface VideoCreationState {
  selectedTemplateId: string | null;
  projectName: string;
  images: VideoImageItem[];
  aspectRatio: VideoAspectRatio;
  selectedMusicTrack: MusicTrack | null;
  musicVolume: number;
  generateNativeAudio: boolean;
  isSubmitting: boolean;
  provider: AIProvider;
}

// We'll handle the order dynamically based on template selection
const CUSTOM_FLOW_STEPS: VideoCreationStep[] = [
  "select-template",
  "select-images",
  "assign-rooms",
  "select-music",
  "review",
];
const TEMPLATE_FLOW_STEPS: VideoCreationStep[] = [
  "select-template",
  "storyboard",
  "select-music",
  "review",
];

const ALL_STEPS: VideoCreationStep[] = [
  "select-template",
  "storyboard",
  "select-images",
  "assign-rooms",
  "select-music",
  "review",
];

export function useVideoCreation() {
  // Step is managed in URL for browser back/forward navigation
  const [step, setStep] = useQueryState(
    "step",
    parseAsStringLiteral(ALL_STEPS)
      .withDefault("select-template")
      .withOptions({ history: "push" })
  );

  const [state, setState] = React.useState<VideoCreationState>({
    selectedTemplateId: null,
    projectName: "",
    images: [],
    aspectRatio: VIDEO_DEFAULTS.ASPECT_RATIO,
    selectedMusicTrack: null,
    musicVolume: VIDEO_DEFAULTS.MUSIC_VOLUME,
    generateNativeAudio: VIDEO_DEFAULTS.GENERATE_NATIVE_AUDIO,
    isSubmitting: false,
    provider: "fal",
  });

  const setTemplateId = React.useCallback((id: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedTemplateId: id,
      // Clear images when switching templates/modes to avoid confusion
      images: [],
    }));
  }, []);

  const setProjectName = React.useCallback((name: string) => {
    setState((prev) => ({ ...prev, projectName: name }));
  }, []);

  const addImages = React.useCallback(
    (newImages: Omit<VideoImageItem, "sequenceOrder">[]) => {
      setState((prev) => {
        // Find the next available sequence order
        const maxOrder = prev.images.reduce(
          (max, img) => Math.max(max, img.sequenceOrder),
          0
        );

        const imagesWithOrder = newImages.map((img, i) => ({
          ...img,
          startImageUrl: img.url,
          startImageId: img.id,
          startImageGenerationId: img.imageGenerationId,
          endImageUrl: img.url,
          endImageId: img.id,
          endImageGenerationId: img.imageGenerationId,
          sequenceOrder: maxOrder + i + 1,
          transitionType: img.transitionType || "seamless",
        }));
        const combined = [...prev.images, ...imagesWithOrder];
        // Limit to max images
        return {
          ...prev,
          images: combined.slice(0, VIDEO_LIMITS.MAX_IMAGES_PER_VIDEO),
        };
      });
    },
    []
  );

  // Specialized function for storyboard slots
  const addImageToSlot = React.useCallback(
    (
      image: Omit<
        VideoImageItem,
        | "sequenceOrder"
        | "startImageUrl"
        | "startImageGenerationId"
        | "endImageUrl"
        | "endImageGenerationId"
      >,
      slotIndex: number,
      framesToSet: "start" | "end" | "both" = "both"
    ) => {
      setState((prev) => {
        // Remove any existing image in this slot
        const filtered = prev.images.filter(
          (img) => img.sequenceOrder !== slotIndex + 1
        );

        // Add new image at specific sequence order (1-based)
        const newImage = {
          ...image,
          startImageUrl:
            framesToSet === "start" || framesToSet === "both" ? image.url : "",
          startImageId:
            framesToSet === "start" || framesToSet === "both" ? image.id : "",
          startImageGenerationId:
            framesToSet === "start" || framesToSet === "both"
              ? image.imageGenerationId
              : null,
          endImageUrl:
            framesToSet === "end" || framesToSet === "both" ? image.url : "",
          endImageId:
            framesToSet === "end" || framesToSet === "both" ? image.id : "",
          endImageGenerationId:
            framesToSet === "end" || framesToSet === "both"
              ? image.imageGenerationId
              : null,
          sequenceOrder: slotIndex + 1,
          transitionType: image.transitionType || "seamless",
        };

        return {
          ...prev,
          images: [...filtered, newImage],
        };
      });
    },
    []
  );

  const updateSlotImage = React.useCallback(
    (
      slotIndex: number,
      type: "start" | "end",
      image: { id: string; url: string; imageGenerationId?: string | null }
    ) => {
      setState((prev) => {
        const existingImage = prev.images.find(
          (img) => img.sequenceOrder === slotIndex + 1
        );
        if (!existingImage) {
          return prev;
        }

        const updatedImage = { ...existingImage };
        if (type === "start") {
          updatedImage.id = image.id;
          updatedImage.url = image.url;
          updatedImage.startImageUrl = image.url;
          updatedImage.startImageId = image.id;
          updatedImage.startImageGenerationId = image.imageGenerationId;
        } else {
          updatedImage.endImageUrl = image.url;
          updatedImage.endImageId = image.id;
          updatedImage.endImageGenerationId = image.imageGenerationId;
        }

        return {
          ...prev,
          images: prev.images.map((img) =>
            img.sequenceOrder === slotIndex + 1 ? updatedImage : img
          ),
        };
      });
    },
    []
  );

  const updateTransitionType = React.useCallback(
    (slotIndex: number, transitionType: "cut" | "seamless") => {
      setState((prev) => {
        return {
          ...prev,
          images: prev.images.map((img) =>
            img.sequenceOrder === slotIndex + 1
              ? { ...img, transitionType }
              : img
          ),
        };
      });
    },
    []
  );

  const removeImage = React.useCallback((id: string) => {
    setState((prev) => {
      // If in template mode, we just remove the image but keep others' positions fixed
      if (prev.selectedTemplateId) {
        return { ...prev, images: prev.images.filter((img) => img.id !== id) };
      }

      // In custom mode, we re-index
      const filtered = prev.images.filter((img) => img.id !== id);
      const reindexed = filtered.map((img, i) => ({
        ...img,
        sequenceOrder: i + 1,
      }));
      return { ...prev, images: reindexed };
    });
  }, []);

  const updateImage = React.useCallback(
    (id: string, updates: Partial<Omit<VideoImageItem, "id" | "url">>) => {
      setState((prev) => ({
        ...prev,
        images: prev.images.map((img) =>
          img.id === id ? { ...img, ...updates } : img
        ),
      }));
    },
    []
  );

  const reorderImages = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      setState((prev) => {
        // Only for custom mode
        if (prev.selectedTemplateId) {
          return prev;
        }

        const newImages = [...prev.images];
        const [removed] = newImages.splice(fromIndex, 1);
        newImages.splice(toIndex, 0, removed);
        // Re-index sequence orders
        const reindexed = newImages.map((img, i) => ({
          ...img,
          sequenceOrder: i + 1,
        }));
        return { ...prev, images: reindexed };
      });
    },
    []
  );

  const autoArrangeByRoomType = React.useCallback(() => {
    setState((prev) => {
      if (prev.selectedTemplateId) {
        return prev; // Disable for templates
      }

      const sorted = autoSequenceClips(prev.images);
      const reindexed = reindexSequenceOrders(sorted);
      return { ...prev, images: reindexed };
    });
  }, []);

  const setAspectRatio = React.useCallback((ratio: VideoAspectRatio) => {
    setState((prev) => ({ ...prev, aspectRatio: ratio }));
  }, []);

  const setMusicTrack = React.useCallback((track: MusicTrack | null) => {
    setState((prev) => ({ ...prev, selectedMusicTrack: track }));
  }, []);

  const setMusicVolume = React.useCallback((volume: number) => {
    setState((prev) => ({
      ...prev,
      musicVolume: Math.min(100, Math.max(0, volume)),
    }));
  }, []);

  const setGenerateNativeAudio = React.useCallback((generate: boolean) => {
    setState((prev) => ({ ...prev, generateNativeAudio: generate }));
  }, []);

  const setIsSubmitting = React.useCallback((submitting: boolean) => {
    setState((prev) => ({ ...prev, isSubmitting: submitting }));
  }, []);

  const setProvider = React.useCallback((newProvider: AIProvider) => {
    setState((prev) => ({ ...prev, provider: newProvider }));
  }, []);

  const goToNextStep = React.useCallback(() => {
    const stepList = state.selectedTemplateId
      ? TEMPLATE_FLOW_STEPS
      : CUSTOM_FLOW_STEPS;
    const currentIndex = stepList.indexOf(step);
    if (currentIndex < stepList.length - 1) {
      setStep(stepList[currentIndex + 1]);
    }
  }, [step, state.selectedTemplateId, setStep]);

  const goToPreviousStep = React.useCallback(() => {
    const stepList = state.selectedTemplateId
      ? TEMPLATE_FLOW_STEPS
      : CUSTOM_FLOW_STEPS;
    const currentIndex = stepList.indexOf(step);
    if (currentIndex > 0) {
      setStep(stepList[currentIndex - 1]);
    }
  }, [step, state.selectedTemplateId, setStep]);

  const canProceed = React.useCallback(() => {
    switch (step) {
      case "select-template":
        // Always allowed to proceed - if they select a template, we go to storyboard.
        // If they don't (conceptually "custom"), they click "Start from Scratch" which sets template to null and goes to select-images.
        // But the UI will handle the "Start from Scratch" vs "Select Template" distinct actions.
        // For the purpose of a generic "Next" button (if it existed), we'd need to know if a selection was made.
        // The SelectTemplateStep will likely handle the navigation directly.
        return true;

      case "select-images":
        return state.images.length >= VIDEO_LIMITS.MIN_IMAGES_PER_VIDEO;

      case "assign-rooms":
        return state.images.every((img) => img.roomType);

      case "storyboard": {
        if (!state.selectedTemplateId) {
          return false;
        }
        const template = getVideoTemplateById(state.selectedTemplateId);
        if (!template) {
          return false;
        }

        // Check if all slots have an image
        // We know images are keyed by sequenceOrder = slotIndex + 1
        const filledSlots = state.images.map((img) => img.sequenceOrder);
        // Check if every slot index (1..slots.length) is present
        for (let i = 1; i <= template.slots.length; i++) {
          if (!filledSlots.includes(i)) {
            return false;
          }
        }
        return true;
      }

      case "select-music":
        return true; // Music is optional

      case "review":
        return state.projectName.trim().length > 0 && state.images.length > 0;

      default:
        return false;
    }
  }, [step, state]);

  const reset = React.useCallback(() => {
    setStep("select-template");
    setState({
      selectedTemplateId: null,
      projectName: "",
      images: [],
      aspectRatio: VIDEO_DEFAULTS.ASPECT_RATIO,
      selectedMusicTrack: null,
      musicVolume: VIDEO_DEFAULTS.MUSIC_VOLUME,
      generateNativeAudio: VIDEO_DEFAULTS.GENERATE_NATIVE_AUDIO,
      isSubmitting: false,
      provider: "fal",
    });
  }, [setStep]);

  return {
    step,
    ...state,
    setStep,
    setTemplateId,
    setProjectName,
    addImages,
    addImageToSlot,
    updateSlotImage,
    updateTransitionType,
    removeImage,
    updateImage,
    reorderImages,
    autoArrangeByRoomType,
    setAspectRatio,
    setMusicTrack,
    setMusicVolume,
    setGenerateNativeAudio,
    setIsSubmitting,
    setProvider,
    goToNextStep,
    goToPreviousStep,
    canProceed,
    reset,
  };
}
