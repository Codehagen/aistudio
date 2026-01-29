"use client";

import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconHome,
  IconLayoutDashboard,
  IconLoader2,
  IconMovie,
  IconMusic,
  IconPhoto,
  IconSparkles,
  IconTemplate,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useVideoCreation,
  type VideoCreationStep,
} from "@/hooks/use-video-creation";
import {
  createVideoProject,
  triggerVideoGeneration,
} from "@/lib/actions/video";
import { cn } from "@/lib/utils";
import { AssignRoomsStep } from "./steps/assign-rooms-step";
import { ReviewStep } from "./steps/review-step";
import { SelectImagesStep } from "./steps/select-images-step";
import { SelectMusicStep } from "./steps/select-music-step";
import { SelectTemplateStep } from "./steps/select-template-step";
import { StoryboardStep } from "./steps/storyboard-step";

// Steps for the "Custom" flow
const CUSTOM_STEPS: {
  id: VideoCreationStep;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "select-template",
    label: "Style",
    icon: <IconTemplate className="h-4 w-4" />,
  },
  {
    id: "select-images",
    label: "Images",
    icon: <IconPhoto className="h-4 w-4" />,
  },
  {
    id: "assign-rooms",
    label: "Rooms",
    icon: <IconHome className="h-4 w-4" />,
  },
  {
    id: "select-music",
    label: "Music",
    icon: <IconMusic className="h-4 w-4" />,
  },
  { id: "review", label: "Review", icon: <IconCheck className="h-4 w-4" /> },
];

// Steps for the "Template" flow
const TEMPLATE_STEPS: {
  id: VideoCreationStep;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "select-template",
    label: "Style",
    icon: <IconTemplate className="h-4 w-4" />,
  },
  {
    id: "storyboard",
    label: "Storyboard",
    icon: <IconLayoutDashboard className="h-4 w-4" />,
  },
  {
    id: "select-music",
    label: "Music",
    icon: <IconMusic className="h-4 w-4" />,
  },
  { id: "review", label: "Review", icon: <IconCheck className="h-4 w-4" /> },
];

function StepIndicator({
  steps,
  currentStep,
}: {
  steps: typeof CUSTOM_STEPS;
  currentStep: VideoCreationStep;
}) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep;
        const isCompleted = index < currentIndex;

        return (
          <React.Fragment key={step.id}>
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-2 font-medium text-sm transition-all duration-300 sm:gap-2 sm:px-4",
                isActive &&
                  "bg-(--accent-teal)/15 text-(--accent-teal) shadow-(--accent-teal)/10 shadow-sm",
                isCompleted && "text-(--accent-teal)",
                !(isActive || isCompleted) && "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full font-semibold text-xs transition-all duration-300",
                  isActive &&
                    "bg-(--accent-teal) text-white shadow-(--accent-teal)/30 shadow-lg",
                  isCompleted && "bg-(--accent-teal) text-white",
                  !(isActive || isCompleted) && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <IconCheck className="h-3.5 w-3.5" />
                ) : (
                  step.icon
                )}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </div>

            {index < steps.length - 1 && (
              <div
                className={cn(
                  "h-px w-6 transition-all duration-300 sm:w-10",
                  index < currentIndex
                    ? "bg-linear-to-r from-(--accent-teal) to-(--accent-teal)/50"
                    : "bg-border"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

const stepTitles: Record<
  VideoCreationStep,
  { title: string; description: string }
> = {
  "select-template": {
    title: "Choose a Style",
    description: "Start with a template or build from scratch",
  },
  storyboard: {
    title: "Build Your Story",
    description: "Add photos to the storyboard slots",
  },
  "select-images": {
    title: "Select Images",
    description: "Choose the images for your property video",
  },
  "assign-rooms": {
    title: "Assign Rooms",
    description: "Label each image with its room type and arrange the sequence",
  },
  "select-music": {
    title: "Background Music",
    description: "Add the perfect soundtrack to your property tour",
  },
  review: {
    title: "Review & Generate",
    description: "Finalize your video settings and start generation",
  },
};

export function VideoCreationWizard() {
  const router = useRouter();
  const creation = useVideoCreation();

  const handleSubmit = React.useCallback(async () => {
    if (!creation.canProceed()) {
      return;
    }

    creation.setIsSubmitting(true);

    try {
      console.log("[VideoCreationWizard] Starting video project creation...");
      // Create the video project
      const result = await createVideoProject({
        name: creation.projectName,
        aspectRatio: creation.aspectRatio,
        musicTrackId: creation.selectedMusicTrack?.id ?? null,
        musicVolume: creation.musicVolume,
        generateNativeAudio: creation.generateNativeAudio,
        provider: creation.provider,
        clips: creation.images.map((img) => ({
          sourceImageUrl: img.startImageUrl || img.url,
          imageGenerationId:
            img.startImageGenerationId || img.imageGenerationId || null,
          endImageUrl: img.endImageUrl || img.url,
          endImageGenerationId:
            img.endImageGenerationId || img.imageGenerationId || null,
          roomType: img.roomType,
          roomLabel: img.roomLabel || null,
          sequenceOrder: img.sequenceOrder,
          transitionType: img.transitionType || "seamless",
        })),
      });

      if (!result.success) {
        console.error("[VideoCreationWizard] Project creation failed:", result);
        throw new Error("Failed to create video project");
      }

      console.log(
        `[VideoCreationWizard] Project created successfully: ${result.videoProjectId}. Triggering generation...`
      );

      // Trigger video generation
      try {
        await triggerVideoGeneration(result.videoProjectId);
      } catch (triggerError) {
        console.error(
          "[VideoCreationWizard] Trigger failed, but project was created:",
          triggerError
        );
        // We still redirect because the project exists, but we show a different message
        toast.warning(
          "Video project created, but generation failed to start automatically.",
          {
            description:
              "You can try to restart the generation from the video details page.",
            duration: 10_000,
          }
        );
        router.push(`/video/${result.videoProjectId}`);
        return;
      }

      console.log(
        "[VideoCreationWizard] Video generation triggered successfully"
      );

      toast.success("Video generation started!", {
        description: "We'll notify you when your video is ready.",
      });

      // Redirect to video detail page
      router.push(`/video/${result.videoProjectId}`);
    } catch (error) {
      console.error(
        "[VideoCreationWizard] General error in handleSubmit:",
        error
      );
      toast.error("Failed to create video", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
      creation.setIsSubmitting(false);
    }
  }, [creation, router]);

  const currentStepInfo = stepTitles[creation.step];

  // Determine which steps to show based on mode
  const steps = creation.selectedTemplateId ? TEMPLATE_STEPS : CUSTOM_STEPS;

  const handleTemplateSelect = (templateId: string) => {
    creation.setTemplateId(templateId);
    creation.setStep("storyboard");
  };

  const handleCustomSelect = () => {
    creation.setTemplateId(null);
    creation.setStep("select-images");
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {/* Cinematic Header with Gradient */}
      <div className="relative border-b bg-linear-to-b from-background via-background to-muted/30">
        {/* Decorative film strip pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent, transparent 20px, currentColor 20px, currentColor 22px)",
          }}
        />

        <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6">
          {/* Logo/Title */}
          <div className="mb-6 flex items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-(--accent-teal) to-(--accent-teal)/70 shadow-(--accent-teal)/20 shadow-lg">
              <IconMovie className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-2xl tracking-tight">
                Create Video
              </h1>
              <p className="text-muted-foreground text-sm">
                Property Tour Generator
              </p>
            </div>
          </div>

          {/* Step Indicator */}
          <StepIndicator currentStep={creation.step} steps={steps} />

          {/* Step Title */}
          <div className="mt-6 animate-fade-in text-center">
            <h2 className="font-semibold text-xl">{currentStepInfo.title}</h2>
            <p className="mt-1 text-muted-foreground">
              {currentStepInfo.description}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div
          className={cn(
            "mx-auto px-4 py-8 transition-all duration-500 sm:px-6",
            creation.step === "storyboard" ? "max-w-full lg:px-12" : "max-w-5xl"
          )}
        >
          <div className="animate-fade-in-up">
            {creation.step === "select-template" && (
              <SelectTemplateStep
                onSelectCustom={handleCustomSelect}
                onSelectTemplate={handleTemplateSelect}
                selectedTemplateId={creation.selectedTemplateId}
              />
            )}

            {creation.step === "storyboard" && creation.selectedTemplateId && (
              <StoryboardStep
                images={creation.images}
                onAddImageToSlot={creation.addImageToSlot}
                onRemoveImage={creation.removeImage}
                onUpdateSlotImage={creation.updateSlotImage}
                onUpdateTransitionType={creation.updateTransitionType}
                selectedTemplateId={creation.selectedTemplateId}
              />
            )}

            {creation.step === "select-images" && (
              <SelectImagesStep
                images={creation.images}
                onAddImages={creation.addImages}
                onRemoveImage={creation.removeImage}
              />
            )}
            {creation.step === "assign-rooms" && (
              <AssignRoomsStep
                images={creation.images}
                onAutoArrange={creation.autoArrangeByRoomType}
                onReorderImages={creation.reorderImages}
                onUpdateImage={creation.updateImage}
              />
            )}
            {creation.step === "select-music" && (
              <SelectMusicStep
                aspectRatio={creation.aspectRatio}
                generateNativeAudio={creation.generateNativeAudio}
                onAspectRatioChange={creation.setAspectRatio}
                onGenerateNativeAudioChange={creation.setGenerateNativeAudio}
                onSelectTrack={creation.setMusicTrack}
                onVolumeChange={creation.setMusicVolume}
                selectedTrack={creation.selectedMusicTrack}
                volume={creation.musicVolume}
              />
            )}
            {creation.step === "review" && (
              <ReviewStep
                aspectRatio={creation.aspectRatio}
                images={creation.images}
                musicTrack={creation.selectedMusicTrack}
                onProjectNameChange={creation.setProjectName}
                onProviderChange={creation.setProvider}
                projectName={creation.projectName}
                provider={creation.provider}
              />
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {creation.step !== "select-template" && (
                <Button
                  className="gap-2"
                  disabled={creation.isSubmitting}
                  onClick={creation.goToPreviousStep}
                  variant="ghost"
                >
                  <IconArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                disabled={creation.isSubmitting}
                onClick={() => router.push("/video")}
                variant="outline"
              >
                Cancel
              </Button>

              {creation.step === "review" ? (
                <Button
                  className="min-w-[160px] gap-2 bg-(--accent-teal) shadow-(--accent-teal)/20 shadow-lg"
                  disabled={!creation.canProceed() || creation.isSubmitting}
                  onClick={handleSubmit}
                >
                  {creation.isSubmitting ? (
                    <>
                      <IconLoader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <IconSparkles className="h-4 w-4" />
                      Generate Video
                    </>
                  )}
                </Button>
              ) : (
                creation.step !== "select-template" && (
                  <Button
                    className="gap-2 bg-(--accent-teal) shadow-(--accent-teal)/20 shadow-lg"
                    disabled={!creation.canProceed()}
                    onClick={creation.goToNextStep}
                  >
                    Continue
                    <IconArrowRight className="h-4 w-4" />
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
