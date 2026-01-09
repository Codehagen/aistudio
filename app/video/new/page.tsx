import { Suspense } from "react";
import { VideoCreationWizard } from "@/components/video/video-creation/video-creation-wizard";

export default function NewVideoPage() {
  return (
    <Suspense>
      <VideoCreationWizard />
    </Suspense>
  );
}
