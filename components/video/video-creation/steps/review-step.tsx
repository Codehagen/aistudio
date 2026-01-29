"use client";

import {
  IconArrowRight,
  IconAspectRatio,
  IconClock,
  IconMovie,
  IconMusic,
  IconPhoto,
} from "@tabler/icons-react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProviderSelect } from "@/components/ui/provider-select";
import type { VideoImageItem } from "@/hooks/use-video-creation";
import type { MusicTrack, VideoAspectRatio } from "@/lib/db/schema";
import type { AIProvider } from "@/lib/providers/types";
import { cn } from "@/lib/utils";
import { VIDEO_ROOM_TYPES } from "@/lib/video/room-sequence";

interface ReviewStepProps {
  images: VideoImageItem[];
  projectName: string;
  onProjectNameChange: (name: string) => void;
  aspectRatio: VideoAspectRatio;
  musicTrack: MusicTrack | null;
  provider: AIProvider;
  onProviderChange: (provider: AIProvider) => void;
}

export function ReviewStep({
  images,
  projectName,
  onProjectNameChange,
  aspectRatio,
  musicTrack,
  provider,
  onProviderChange,
}: ReviewStepProps) {
  const totalDuration = images.length * 5;

  return (
    <div className="space-y-8">
      {/* Project Name */}
      <div className="space-y-2">
        <Label className="font-medium text-base" htmlFor="project-name">
          Video Name
        </Label>
        <Input
          className="h-12 text-lg"
          id="project-name"
          onChange={(e) => onProjectNameChange(e.target.value)}
          placeholder="e.g., 123 Main Street Property Tour"
          value={projectName}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-linear-to-br from-background to-muted/30 p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <IconPhoto className="h-4 w-4" />
            <span className="text-sm">Clips</span>
          </div>
          <div className="mt-2 font-bold text-2xl">{images.length}</div>
        </div>

        <div className="rounded-xl border bg-linear-to-br from-background to-muted/30 p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <IconClock className="h-4 w-4" />
            <span className="text-sm">Duration</span>
          </div>
          <div className="mt-2 font-bold text-2xl">{totalDuration}s</div>
        </div>

        <div className="rounded-xl border bg-linear-to-br from-background to-muted/30 p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <IconAspectRatio className="h-4 w-4" />
            <span className="text-sm">Aspect</span>
          </div>
          <div className="mt-2 font-bold text-2xl">{aspectRatio}</div>
        </div>
      </div>

      {/* Music Info */}
      <div className="rounded-xl border bg-muted/30 p-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full",
              musicTrack
                ? "bg-(--accent-teal)/10 text-(--accent-teal)"
                : "bg-muted text-muted-foreground"
            )}
          >
            <IconMusic className="h-5 w-5" />
          </div>
          <div>
            <div className="font-medium">
              {musicTrack ? musicTrack.name : "No Background Music"}
            </div>
            <div className="text-muted-foreground text-sm">
              {musicTrack
                ? `${musicTrack.artist} • ${musicTrack.category}`
                : "Video will have no audio"}
            </div>
          </div>
        </div>
      </div>

      {/* AI Provider Selection */}
      <div className="space-y-3">
        <Label className="font-medium text-base">AI Provider</Label>
        <div className="flex items-center gap-4">
          <ProviderSelect onChange={onProviderChange} value={provider} />
          <div className="flex-1 text-muted-foreground text-sm">
            {provider === "fal" ? (
              <span>Fal.ai (Kling Video) - 5-10s clips</span>
            ) : (
              <span>xAI (Grok) - 1-15s clips</span>
            )}
          </div>
        </div>
      </div>

      {/* Clip Sequence Preview */}
      <div>
        <h4 className="mb-4 flex items-center gap-2 font-medium">
          <IconMovie className="h-4 w-4" />
          Video Sequence
        </h4>
        <div className="relative">
          {/* Timeline */}
          <div className="absolute top-8 bottom-8 left-6 w-0.5 bg-linear-to-b from-(--accent-teal) via-(--accent-teal)/50 to-transparent" />

          <div className="space-y-3">
            {images.map((image, index) => {
              const roomConfig = VIDEO_ROOM_TYPES.find(
                (r) => r.id === image.roomType
              );
              return (
                <div
                  className="flex animate-fade-in-up items-center gap-4"
                  key={image.id}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Timeline Node */}
                  <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-(--accent-teal) font-bold text-sm text-white shadow-(--accent-teal)/20 shadow-lg">
                      {index + 1}
                    </div>
                  </div>

                  {/* Clip Card */}
                  <div className="flex flex-1 items-center gap-4 rounded-xl border bg-card p-3">
                    <div className="relative flex h-14 w-24 shrink-0 overflow-hidden rounded-lg border bg-muted">
                      {image.startImageUrl &&
                      image.endImageUrl &&
                      image.startImageUrl !== image.endImageUrl ? (
                        <>
                          <div className="relative flex-1">
                            <Image
                              alt={`Clip ${index + 1} start`}
                              className="object-cover"
                              fill
                              sizes="48px"
                              src={image.startImageUrl}
                            />
                            <div className="absolute top-0.5 left-0.5 z-10 rounded bg-black/60 px-1 py-0 font-bold text-[7px] text-white uppercase backdrop-blur-sm">
                              Start
                            </div>
                          </div>
                          <div className="relative flex-1 border-white/20 border-l">
                            <Image
                              alt={`Clip ${index + 1} end`}
                              className="object-cover"
                              fill
                              sizes="48px"
                              src={image.endImageUrl}
                            />
                            <div className="absolute top-0.5 right-0.5 z-10 rounded bg-black/60 px-1 py-0 font-bold text-[7px] text-white uppercase backdrop-blur-sm">
                              End
                            </div>
                          </div>
                          <div className="absolute top-1/2 left-1/2 z-20 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow-xs">
                            <IconArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                          </div>
                        </>
                      ) : (
                        <Image
                          alt={`Clip ${index + 1}`}
                          className="object-cover"
                          fill
                          sizes="96px"
                          src={image.url}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {image.roomLabel || roomConfig?.label || "Unknown Room"}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {roomConfig?.label} • 5 seconds
                      </div>
                    </div>
                    <div className="shrink-0 font-mono text-muted-foreground text-sm">
                      {index * 5}s – {(index + 1) * 5}s
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
