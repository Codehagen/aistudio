import { logger, metadata, task } from "@trigger.dev/sdk/v3";
import {
  getVideoClips,
  getVideoProjectById,
  updateVideoProject,
  updateVideoProjectCounts,
} from "@/lib/db/queries";
import {
  calculateVideoCost,
  costToCents,
  VIDEO_DEFAULTS,
} from "@/lib/video/video-constants";
import { compileVideoTask } from "./compile-video";
import { generateTransitionClipTask } from "./generate-transition-clip";
import { generateVideoClipTask } from "./generate-video-clip";

export interface GenerateVideoPayload {
  videoProjectId: string;
}

export interface GenerateVideoStatus {
  step: "starting" | "generating" | "compiling" | "completed" | "failed";
  label: string;
  clipIndex?: number;
  totalClips?: number;
  progress?: number;
}

export const generateVideoTask = task({
  id: "generate-video",
  queue: {
    name: "video-generation",
    concurrencyLimit: 1,
  },
  maxDuration: 1800, // 30 minutes total
  retry: {
    maxAttempts: 1, // Don't retry the orchestrator itself
  },
  run: async (payload: GenerateVideoPayload) => {
    const { videoProjectId } = payload;

    try {
      // Step 1: Fetch video project and clips
      metadata.set("status", {
        step: "starting",
        label: "Starting video generation…",
        progress: 5,
      } satisfies GenerateVideoStatus);

      logger.info("Starting video generation", { videoProjectId });

      const projectData = await getVideoProjectById(videoProjectId);
      if (!projectData) {
        throw new Error(`Video project not found: ${videoProjectId}`);
      }

      const { videoProject } = projectData;
      const clips = await getVideoClips(videoProjectId);

      if (clips.length === 0) {
        throw new Error("No clips to generate");
      }

      // Update project status to generating
      await updateVideoProject(videoProjectId, {
        status: "generating",
        clipCount: clips.length,
        estimatedCost: costToCents(
          calculateVideoCost(
            clips.length,
            VIDEO_DEFAULTS.CLIP_DURATION,
            videoProject.generateNativeAudio
          )
        ),
      });

      // Step 2: Generate all clips in parallel
      metadata.set("status", {
        step: "generating",
        label: `Generating ${clips.length} clips…`,
        clipIndex: 0,
        totalClips: clips.length,
        progress: 10,
      } satisfies GenerateVideoStatus);

      // Extract provider from metadata
      const projectMetadata = videoProject.metadata as {
        provider?: "fal" | "xai";
      } | null;
      const provider = projectMetadata?.provider ?? "fal";

      logger.info("Triggering clip generation tasks", {
        clipCount: clips.length,
        provider,
      });

      // Trigger all clip generation tasks and wait for them
      const clipResults = await generateVideoClipTask.batchTriggerAndWait(
        clips.map((clip) => {
          return {
            payload: {
              clipId: clip.id,
              tailImageUrl: clip.endImageUrl || clip.sourceImageUrl,
              targetRoomLabel:
                clip.roomLabel || clip.roomType.replace(/-/g, " "),
              provider,
            },
          };
        })
      );

      // Check results
      const successfulClips = clipResults.runs.filter((r) => r.ok);
      const failedClips = clipResults.runs.filter((r) => !r.ok);

      logger.info("Clip generation completed", {
        successful: successfulClips.length,
        failed: failedClips.length,
      });

      // Update counts
      await updateVideoProjectCounts(videoProjectId);

      // If all clips failed, mark as failed
      if (successfulClips.length === 0) {
        throw new Error("All clip generations failed");
      }

      // If some clips failed, log warning but continue with successful ones
      if (failedClips.length > 0) {
        logger.warn("Some clips failed to generate", {
          failedCount: failedClips.length,
          failedClipIds: failedClips.map((r) => r.taskIdentifier),
        });
      }

      // Step 2.5: Generate transition clips for seamless transitions
      const clipsWithTransitions = clips.filter((clip, index) => {
        // Check if this clip has seamless transition enabled
        // and there's a next clip
        return clip.transitionType === "seamless" && index < clips.length - 1;
      });

      if (clipsWithTransitions.length > 0) {
        metadata.set("status", {
          step: "generating",
          label: `Generating ${clipsWithTransitions.length} transitions…`,
          clipIndex: successfulClips.length,
          totalClips: successfulClips.length + clipsWithTransitions.length,
          progress: 60,
        } satisfies GenerateVideoStatus);

        logger.info("Generating transition clips", {
          transitionCount: clipsWithTransitions.length,
        });

        // Reload clips to get updated clip URLs
        await getVideoClips(videoProjectId);

        const transitionResults =
          await generateTransitionClipTask.batchTriggerAndWait(
            clipsWithTransitions.map((clip) => {
              const clipIndex = clips.findIndex((c) => c.id === clip.id);
              const nextClip = clips[clipIndex + 1];

              return {
                payload: {
                  clipId: clip.id,
                  fromImageUrl: clip.endImageUrl || clip.sourceImageUrl,
                  toImageUrl: nextClip.sourceImageUrl,
                  videoProjectId,
                  workspaceId: videoProject.workspaceId,
                  aspectRatio: videoProject.aspectRatio as
                    | "16:9"
                    | "9:16"
                    | "1:1",
                },
              };
            })
          );

        const successfulTransitions = transitionResults.runs.filter(
          (r) => r.ok
        );
        const failedTransitions = transitionResults.runs.filter((r) => !r.ok);

        logger.info("Transition generation completed", {
          successful: successfulTransitions.length,
          failed: failedTransitions.length,
        });

        if (failedTransitions.length > 0) {
          logger.warn("Some transitions failed to generate", {
            failedCount: failedTransitions.length,
          });
        }
      }

      // Step 3: Compile video
      metadata.set("status", {
        step: "compiling",
        label: "Compiling video…",
        progress: 70,
      } satisfies GenerateVideoStatus);

      // Update project status to compiling
      await updateVideoProject(videoProjectId, {
        status: "compiling",
      });

      logger.info("Triggering video compilation", { videoProjectId });

      // Trigger and wait for compilation
      const compileResult = await compileVideoTask.triggerAndWait({
        videoProjectId,
      });

      if (!compileResult.ok) {
        const compileErrorMessage =
          compileResult.error instanceof Error
            ? compileResult.error.message
            : typeof compileResult.error === "string"
              ? compileResult.error
              : "Video compilation failed";
        throw new Error(compileErrorMessage);
      }

      // Calculate actual cost
      const actualCost = costToCents(
        calculateVideoCost(
          successfulClips.length,
          VIDEO_DEFAULTS.CLIP_DURATION,
          videoProject.generateNativeAudio
        )
      );

      // Update final status
      await updateVideoProject(videoProjectId, {
        actualCost,
      });

      metadata.set("status", {
        step: "completed",
        label: "Complete",
        progress: 100,
      } satisfies GenerateVideoStatus);

      logger.info("Video generation completed", {
        videoProjectId,
        successfulClips: successfulClips.length,
        failedClips: failedClips.length,
        actualCost,
      });

      return {
        success: true,
        videoProjectId,
        finalVideoUrl: compileResult.output?.finalVideoUrl,
        successfulClips: successfulClips.length,
        failedClips: failedClips.length,
        actualCost,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error("Video generation failed", {
        videoProjectId,
        error: errorMessage,
      });

      // Set failed status in metadata immediately for UI
      metadata.set("status", {
        step: "failed",
        label: `Generation failed: ${errorMessage}`,
        progress: 0,
      } satisfies GenerateVideoStatus);

      // Update project status in DB (defensive check in case project was deleted/not found)
      try {
        await updateVideoProject(videoProjectId, {
          status: "failed",
          errorMessage,
        });
      } catch (dbError) {
        logger.error("Failed to update project status in database", {
          videoProjectId,
          error:
            dbError instanceof Error ? dbError.message : "Unknown DB error",
        });
      }

      throw error;
    }
  },
});
