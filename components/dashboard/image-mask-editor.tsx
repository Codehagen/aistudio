"use client";

import {
  IconArrowBackUp,
  IconLoader2,
  IconPlus,
  IconSparkles,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useInpaint } from "@/hooks/use-inpaint";
import type { ImageGeneration } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

interface ImageMaskEditorProps {
  image: ImageGeneration;
  latestVersion: number;
  onClose: () => void;
  onEditStarted?: (runId: string, newImageId: string) => void;
}

export function ImageMaskEditor({
  image,
  latestVersion,
  onClose,
  onEditStarted,
}: ImageMaskEditorProps) {
  const router = useRouter();
  const { inpaint, isProcessing, error } = useInpaint();

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const fabricRef = React.useRef<InstanceType<
    typeof import("fabric").Canvas
  > | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Ref callback to handle canvas unmounting
  const canvasRefCallback = React.useCallback(
    (element: HTMLCanvasElement | null) => {
      console.log("[Canvas Ref] Callback called", {
        hasElement: !!element,
        mode,
      });

      // Always update the ref first
      canvasRef.current = element;

      // Update state to trigger initialization effect
      setCanvasElementReady(!!element);

      // Only handle cleanup when unmounting (element becomes null)
      if (!element && fabricRef.current) {
        // Dispose canvas before React removes it from DOM
        try {
          const canvasElement = fabricRef.current.getElement();
          if (canvasElement) {
            // Remove event listeners first
            try {
              fabricRef.current.off();
            } catch (e) {
              // Ignore
            }

            // Only dispose if element is still in DOM
            if (canvasElement.isConnected && canvasElement.parentNode) {
              try {
                fabricRef.current.dispose();
              } catch (disposeError) {
                // Suppress removeChild errors
                const errorMessage =
                  disposeError instanceof Error
                    ? disposeError.message
                    : String(disposeError);
                if (
                  !(
                    errorMessage.includes("removeChild") ||
                    errorMessage.includes("NotFoundError")
                  )
                ) {
                  console.warn("Error in canvas ref callback:", disposeError);
                }
              }
            }
          }
        } catch (error) {
          // Suppress all errors
        } finally {
          fabricRef.current = null;
          setIsCanvasReady(false);
        }
      }
      // When element is mounted (not null), don't do anything here
      // Let the initialization effect handle it
    },
    []
  );

  type EditMode = "remove" | "add";
  const [brushSize, setBrushSize] = React.useState(30);
  const [mode, setMode] = React.useState<EditMode>("remove");
  const [imageDimensions, setImageDimensions] = React.useState({
    width: 0,
    height: 0,
  });
  const [isCanvasReady, setIsCanvasReady] = React.useState(false);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [canvasElementReady, setCanvasElementReady] = React.useState(false);
  const [canvasHistory, setCanvasHistory] = React.useState<string[]>([]);
  const [cursorPosition, setCursorPosition] = React.useState<{
    x: number;
    y: number;
  } | null>(null);
  const [showReplaceDialog, setShowReplaceDialog] = React.useState(false);
  const [pendingSubmitData, setPendingSubmitData] = React.useState<{
    maskDataUrl: string;
    prompt: string;
    mode: EditMode;
  } | null>(null);
  const [objectDescription, setObjectDescription] = React.useState("");
  const [showObjectDescriptionDialog, setShowObjectDescriptionDialog] =
    React.useState(false);
  const [showObjectRefinementDialog, setShowObjectRefinementDialog] =
    React.useState(false);
  const [objectDetails, setObjectDetails] = React.useState({
    name: "",
    size: "medium" as "small" | "medium" | "large",
    style: "",
    color: "",
  });

  // Check if we're editing an older version
  const currentVersion = image.version || 1;
  const isEditingOldVersion = currentVersion < latestVersion;

  // Use result image if available, otherwise original
  const sourceImageUrl = image.resultImageUrl || image.originalImageUrl;

  // Step 1: Load image to get dimensions
  React.useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      // Calculate dimensions to fit container while maintaining aspect ratio
      const containerWidth = container.clientWidth - 64; // account for padding
      const containerHeight = container.clientHeight - 64;
      const imgAspect = img.width / img.height;
      const containerAspect = containerWidth / containerHeight;

      let canvasWidth: number;
      let canvasHeight: number;

      if (imgAspect > containerAspect) {
        canvasWidth = Math.min(containerWidth, img.width);
        canvasHeight = canvasWidth / imgAspect;
      } else {
        canvasHeight = Math.min(containerHeight, img.height);
        canvasWidth = canvasHeight * imgAspect;
      }

      setImageDimensions({ width: canvasWidth, height: canvasHeight });
      setImageLoaded(true);
    };

    img.onerror = () => {
      console.error("Failed to load image:", sourceImageUrl);
    };

    img.src = sourceImageUrl;
  }, [sourceImageUrl]);

  // Step 2: Initialize Fabric.js after canvas is rendered
  React.useEffect(() => {
    console.log("[Canvas Init] Effect running", {
      imageLoaded,
      hasCanvasRef: !!canvasRef.current,
      canvasElementReady,
      imageDimensions,
      mode,
    });

    if (
      !(imageLoaded && canvasRef.current && canvasElementReady) ||
      imageDimensions.width === 0
    ) {
      // Reset ready state if conditions aren't met
      if (isCanvasReady) {
        setIsCanvasReady(false);
      }
      console.log("[Canvas Init] Conditions not met, skipping");
      return;
    }

    console.log("[Canvas Init] Starting initialization");

    // Dynamic import to avoid SSR issues
    const initFabric = async () => {
      // Store the current canvas element reference to check later
      const currentCanvasElement = canvasRef.current;

      if (!(currentCanvasElement && currentCanvasElement.parentNode)) {
        setIsCanvasReady(false);
        return;
      }

      try {
        const { Canvas, PencilBrush } = await import("fabric");

        // Verify canvas element is still valid after async import
        if (!(canvasRef.current && canvasRef.current.parentNode)) {
          setIsCanvasReady(false);
          return;
        }

        // Dispose existing canvas if any
        if (fabricRef.current) {
          try {
            // Check if canvas element still exists in DOM before disposing
            const canvasElement = fabricRef.current.getElement();
            if (canvasElement) {
              // Use isConnected to check if element is still in the DOM tree
              if (canvasElement.isConnected && canvasElement.parentNode) {
                fabricRef.current.dispose();
              } else {
                // Canvas was already removed from DOM, manually clean up
                // Clear event listeners without calling dispose
                try {
                  fabricRef.current.off(); // Remove all event listeners
                } catch (e) {
                  // Ignore errors from event cleanup
                }
                fabricRef.current = null;
              }
            } else {
              fabricRef.current = null;
            }
          } catch (error) {
            // If dispose fails, just clear the ref
            // This can happen when React unmounts the canvas element
            // Suppress the error to prevent it from propagating
            fabricRef.current = null;
          }
        }

        // Final check before creating new canvas
        if (!(canvasRef.current && canvasRef.current.parentNode)) {
          setIsCanvasReady(false);
          return;
        }

        const canvas = new Canvas(canvasRef.current, {
          width: imageDimensions.width,
          height: imageDimensions.height,
          isDrawingMode: true,
          backgroundColor: "transparent",
        });

        const brush = new PencilBrush(canvas);
        brush.color =
          mode === "remove"
            ? "rgba(239, 68, 68, 0.6)"
            : "rgba(34, 197, 94, 0.6)";
        brush.width = brushSize;
        canvas.freeDrawingBrush = brush;

        fabricRef.current = canvas;
        setIsCanvasReady(true);
        console.log("[Canvas Init] Successfully initialized");
      } catch (error) {
        console.error("[Canvas Init] Error initializing Fabric canvas:", error);
        setIsCanvasReady(false);
      }
    };

    initFabric();

    return () => {
      if (fabricRef.current) {
        try {
          // Check if canvas element still exists in DOM before disposing
          const canvasElement = fabricRef.current.getElement();
          if (canvasElement) {
            // Check if element is still connected to the DOM
            if (canvasElement.isConnected && canvasElement.parentNode) {
              // Double-check right before dispose to avoid race conditions
              // React might have removed it between the check and dispose call
              const parent = canvasElement.parentNode;

              // Remove event listeners first to prevent any issues
              try {
                fabricRef.current.off();
              } catch (e) {
                // Ignore errors from event cleanup
              }

              // Now dispose - wrap in try-catch to suppress removeChild errors
              try {
                // Verify parent still exists right before dispose
                if (canvasElement.parentNode === parent && parent) {
                  fabricRef.current.dispose();
                } else {
                  // Element was removed between check and dispose
                  // Just clear the ref
                  fabricRef.current = null;
                }
              } catch (disposeError) {
                // Suppress NotFoundError and removeChild errors
                // This can happen if React already removed the element
                const errorMessage =
                  disposeError instanceof Error
                    ? disposeError.message
                    : String(disposeError);
                if (
                  !(
                    errorMessage.includes("removeChild") ||
                    errorMessage.includes("NotFoundError")
                  )
                ) {
                  // Only log unexpected errors
                  console.warn("Error disposing canvas:", disposeError);
                }
                // Clear ref on any error
                fabricRef.current = null;
              }
            } else {
              // Element was already removed from DOM, manually clean up
              // Clear event listeners and references without calling dispose
              try {
                fabricRef.current.off(); // Remove all event listeners
              } catch (e) {
                // Ignore errors from event cleanup
              }
            }
          }
        } catch (error) {
          // If anything fails, just clear the ref
          // This is safe - the canvas was already removed from DOM
        } finally {
          fabricRef.current = null;
          setIsCanvasReady(false);
        }
      }
    };
  }, [
    imageLoaded,
    imageDimensions,
    brushSize,
    canvasElementReady,
    mode,
    image.id,
  ]);

  // Reset canvas state when mode changes
  // The main initialization effect will handle cleanup and re-initialization
  React.useEffect(() => {
    console.log("[Mode Change] Mode changed to:", mode);

    // Reset state when mode changes - this will trigger cleanup in main effect
    setIsCanvasReady(false);
    setCanvasHistory([]);
    // Reset canvasElementReady to ensure initialization runs when new canvas mounts
    // The ref callback will set it back to true when the new canvas element mounts
    setCanvasElementReady(false);
  }, []);

  // Update brush settings based on mode
  React.useEffect(() => {
    if (!(fabricRef.current?.freeDrawingBrush && isCanvasReady)) {
      return;
    }

    fabricRef.current.freeDrawingBrush.width = brushSize;
    // Visual feedback colors - red for remove, green for add
    fabricRef.current.freeDrawingBrush.color =
      mode === "remove"
        ? "rgba(239, 68, 68, 0.6)" // Red for remove
        : "rgba(34, 197, 94, 0.6)"; // Green for add
  }, [brushSize, mode, isCanvasReady]);

  // Track canvas history for undo
  React.useEffect(() => {
    if (!(fabricRef.current && isCanvasReady)) {
      return;
    }

    const canvas = fabricRef.current;
    const handlePathCreated = () => {
      // Save current state before the new path for undo
      const json = JSON.stringify(canvas.toJSON());
      setCanvasHistory((prev) => [...prev, json]);
    };

    canvas.on("path:created", handlePathCreated);
    return () => {
      canvas.off("path:created", handlePathCreated);
    };
  }, [isCanvasReady]);

  const handleUndo = React.useCallback(() => {
    if (!fabricRef.current || canvasHistory.length === 0) {
      return;
    }

    const canvas = fabricRef.current;
    // Remove the last state (current)
    const newHistory = canvasHistory.slice(0, -1);

    if (newHistory.length === 0) {
      // No more history, clear canvas
      canvas.clear();
      canvas.backgroundColor = "transparent";
      canvas.renderAll();
    } else {
      // Load previous state
      const prevState = newHistory.at(-1);
      if (prevState) {
        canvas.loadFromJSON(prevState, () => {
          canvas.renderAll();
        });
      }
    }

    setCanvasHistory(newHistory);
  }, [canvasHistory]);

  const handleClear = React.useCallback(() => {
    if (!fabricRef.current) {
      return;
    }

    fabricRef.current.clear();
    fabricRef.current.backgroundColor = "transparent";
    fabricRef.current.renderAll();
    setCanvasHistory([]);
    setObjectDescription("");
  }, [mode]);

  // Track cursor position for brush preview
  const handleCanvasMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setCursorPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    []
  );

  const handleCanvasMouseLeave = React.useCallback(() => {
    setCursorPosition(null);
  }, []);

  // Execute the actual API call
  const executeInpaint = React.useCallback(
    async (
      maskDataUrl: string,
      prompt: string,
      editMode: EditMode,
      replaceNewerVersions: boolean
    ) => {
      const result = await inpaint(
        image.id,
        maskDataUrl,
        prompt,
        editMode,
        replaceNewerVersions
      );

      if (result.success && result.runId && result.newImageId) {
        // Show success toast
        toast.success("Edit started! Processing in background...");

        // Pass runId and newImageId to parent for optimistic updates
        if (onEditStarted) {
          onEditStarted(result.runId, result.newImageId);
        }

        // Brief delay before closing for visual feedback
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Refresh and close
        router.refresh();
        onClose();
      } else if (!result.success) {
        // Show error toast
        toast.error("Failed to start edit. Please try again.");
      }
    },
    [image.id, inpaint, router, onClose, onEditStarted]
  );

  // Generate prompt for adding object
  const generateAddPrompt = React.useCallback(
    (details: typeof objectDetails) => {
      const { name, size, style, color } = details;

      // Build prompt following Qwen inpainting best practices:
      // 1. Be clear and specific about the object
      // 2. Maintain contextual consistency
      // 3. Describe object details (size, style, color)
      // 4. Ensure it matches room aesthetic

      let prompt = `Add a ${size} ${name}`;

      // Add style and color details
      if (style) prompt += ` in ${style} style`;
      if (color) prompt += ` with ${color} color`;

      // Add contextual instructions
      prompt += ` that matches the room's aesthetic, lighting, and perspective. `;
      prompt +=
        "Keep the existing furniture, walls, and layout exactly the same. ";
      prompt += `The ${name} should blend seamlessly with the existing decor and appear naturally integrated into the scene.`;

      return prompt;
    },
    []
  );

  // Proceed with adding object after refinement is provided
  const proceedWithAdd = React.useCallback(async () => {
    if (!(fabricRef.current && objectDetails.name.trim())) {
      return;
    }

    // Generate prompt from object details
    const generatedPrompt = generateAddPrompt(objectDetails);

    // Helper to proceed with submission (or show dialog)
    const proceedWithSubmit = async (maskDataUrl: string) => {
      if (isEditingOldVersion) {
        // Show confirmation dialog
        setPendingSubmitData({
          maskDataUrl,
          prompt: generatedPrompt,
          mode: "add",
        });
        setShowReplaceDialog(true);
      } else {
        // Submit directly
        await executeInpaint(maskDataUrl, generatedPrompt, "add", false);
      }
    };

    // ADD MODE: Create mask from drawn strokes
    const fabricCanvas = fabricRef.current;
    const originalPaths = fabricCanvas.getObjects("path");

    if (!originalPaths.length) {
      toast.info("Please draw the area where you want to add the object");
      return;
    }

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = imageDimensions.width;
    tempCanvas.height = imageDimensions.height;
    const tempCtx = tempCanvas.getContext("2d");

    if (!tempCtx) {
      return;
    }

    // Fill with black (no edit areas)
    tempCtx.fillStyle = "black";
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Temporarily change all path colors to white for the mask
    originalPaths.forEach((path) => {
      path.set("stroke", "white");
    });
    fabricCanvas.renderAll();

    const fabricDataUrl = fabricCanvas.toDataURL({
      format: "png",
      multiplier: 1,
    });

    // Restore original colors
    originalPaths.forEach((path) => {
      path.set(
        "stroke",
        mode === "remove" ? "rgba(239, 68, 68, 0.6)" : "rgba(34, 197, 94, 0.6)"
      );
    });
    fabricCanvas.renderAll();

    const maskImg = new window.Image();
    maskImg.onload = async () => {
      tempCtx.drawImage(maskImg, 0, 0);

      // Get the final mask as data URL
      const maskDataUrl = tempCanvas.toDataURL("image/png");

      await proceedWithSubmit(maskDataUrl);
    };
    maskImg.src = fabricDataUrl;
  }, [
    objectDetails,
    imageDimensions,
    isEditingOldVersion,
    executeInpaint,
    generateAddPrompt,
    mode,
  ]);

  // Proceed with removal after description is provided
  const proceedWithRemoval = React.useCallback(async () => {
    if (!(fabricRef.current && objectDescription.trim())) {
      return;
    }

    // Generate prompt with object description
    const generatedPrompt = `Remove the ${objectDescription.trim()} and realistically fill in the background.`;

    // Helper to proceed with submission (or show dialog)
    const proceedWithSubmit = async (maskDataUrl: string) => {
      if (isEditingOldVersion) {
        // Show confirmation dialog
        setPendingSubmitData({
          maskDataUrl,
          prompt: generatedPrompt,
          mode: "remove",
        });
        setShowReplaceDialog(true);
      } else {
        // Submit directly
        await executeInpaint(maskDataUrl, generatedPrompt, "remove", false);
      }
    };

    // REMOVE MODE: Create mask and use Qwen Image Edit Inpaint
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = imageDimensions.width;
    tempCanvas.height = imageDimensions.height;
    const tempCtx = tempCanvas.getContext("2d");

    if (!tempCtx) {
      return;
    }

    // Fill with black (no edit areas)
    tempCtx.fillStyle = "black";
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw the fabric canvas content - convert colored strokes to white for mask
    const fabricCanvas = fabricRef.current;
    const originalPaths = fabricCanvas.getObjects("path");

    // Temporarily change all path colors to white for the mask
    originalPaths.forEach((path) => {
      path.set("stroke", "white");
    });
    fabricCanvas.renderAll();

    const fabricDataUrl = fabricCanvas.toDataURL({
      format: "png",
      multiplier: 1,
    });

    // Restore original colors
    originalPaths.forEach((path) => {
      path.set("stroke", "rgba(239, 68, 68, 0.6)");
    });
    fabricCanvas.renderAll();

    const maskImg = new window.Image();
    maskImg.onload = async () => {
      tempCtx.drawImage(maskImg, 0, 0);

      // Get the final mask as data URL
      const maskDataUrl = tempCanvas.toDataURL("image/png");

      await proceedWithSubmit(maskDataUrl);
    };
    maskImg.src = fabricDataUrl;
  }, [objectDescription, imageDimensions, isEditingOldVersion, executeInpaint]);

  // Handle confirmed object description
  const handleConfirmObjectDescription = React.useCallback(() => {
    if (!objectDescription.trim()) {
      return;
    }

    setShowObjectDescriptionDialog(false);
    // Proceed with removal now that we have the description
    proceedWithRemoval();
  }, [objectDescription, proceedWithRemoval]);

  // Handle confirmed replace
  const handleConfirmReplace = React.useCallback(async () => {
    if (!pendingSubmitData) {
      return;
    }

    setShowReplaceDialog(false);
    await executeInpaint(
      pendingSubmitData.maskDataUrl,
      pendingSubmitData.prompt,
      pendingSubmitData.mode,
      true // replaceNewerVersions
    );
    setPendingSubmitData(null);
  }, [pendingSubmitData, executeInpaint]);

  const handleSubmit = React.useCallback(async () => {
    if (!fabricRef.current) {
      return;
    }

    // For remove mode, check if we have object description
    if (mode === "remove") {
      if (!objectDescription.trim()) {
        // Show dialog to get object description
        setShowObjectDescriptionDialog(true);
        return;
      }
      // We have description, proceed with removal
      await proceedWithRemoval();
      return;
    }

    // ADD MODE: Check if we have a mask
    if (mode === "add") {
      if (canvasHistory.length === 0) {
        toast.info("Please draw the area where you want to add the object");
        return;
      }
      setShowObjectRefinementDialog(true);
      return;
    }
  }, [
    mode,
    objectDescription,
    canvasHistory.length,
    proceedWithRemoval,
  ]);

  // Handle confirmed object refinement
  const handleConfirmAddObject = React.useCallback(async () => {
    if (!objectDetails.name.trim()) {
      return;
    }

    setShowObjectRefinementDialog(false);

    // Proceed with add - rectangle exists
    await proceedWithAdd();
  }, [objectDetails, proceedWithAdd]);

  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isProcessing]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      {/* Header / Toolbar */}
      <div className="flex items-center justify-between border-white/10 border-b bg-black/50 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <h2 className="font-semibold text-lg text-white">Edit Image</h2>

          {/* Mode selector */}
          <div className="flex items-center gap-1 rounded-lg bg-white/10 p-1">
            <Button
              className={cn(
                "gap-1.5 text-white hover:bg-white/20 hover:text-white",
                mode === "remove" && "bg-red-500/30"
              )}
              onClick={() => setMode("remove")}
              size="sm"
              variant="ghost"
            >
              <IconTrash className="h-4 w-4" />
              Remove Object
            </Button>
            <Button
              className={cn(
                "gap-1.5 text-white hover:bg-white/20 hover:text-white",
                mode === "add" && "bg-green-500/30"
              )}
              onClick={() => setMode("add")}
              size="sm"
              variant="ghost"
            >
              <IconPlus className="h-4 w-4" />
              Add Object
            </Button>
          </div>

          {/* Brush size */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/70">Size:</span>
            <Slider
              className="w-32"
              max={100}
              min={5}
              onValueChange={([value]) => setBrushSize(value)}
              step={5}
              value={[brushSize]}
            />
            <span className="w-8 text-sm text-white/70 tabular-nums">
              {brushSize}
            </span>
          </div>

          {/* Undo button */}
          <Button
            className="gap-1.5 text-white hover:bg-white/20 hover:text-white disabled:opacity-40"
            disabled={canvasHistory.length === 0}
            onClick={handleUndo}
            size="sm"
            variant="ghost"
          >
            <IconArrowBackUp className="h-4 w-4" />
            Undo
          </Button>

          {/* Clear button */}
          <Button
            className="gap-1.5 text-white/70 hover:bg-white/20 hover:text-white"
            onClick={handleClear}
            size="sm"
            variant="ghost"
          >
            Clear
          </Button>
        </div>

        {/* Close button */}
        <Button
          className="text-white hover:bg-white/20 hover:text-white"
          disabled={isProcessing}
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <IconX className="h-5 w-5" />
        </Button>
      </div>

      {/* Canvas area */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden p-8"
        ref={containerRef}
      >
        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="text-center text-white">
              <IconLoader2 className="mx-auto mb-2 h-8 w-8 animate-spin" />
              <p className="text-sm">Starting edit...</p>
              <p className="mt-1 text-white/70 text-xs">
                This may take 20-30 seconds
              </p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {!imageLoaded && (
          <div className="flex items-center gap-2 text-white/70">
            <IconLoader2 className="h-5 w-5 animate-spin" />
            Loading image...
          </div>
        )}

        {/* Background image + Canvas */}
        {imageLoaded && imageDimensions.width > 0 && (
          <>
            <div
              className="relative"
              onMouseLeave={handleCanvasMouseLeave}
              onMouseMove={handleCanvasMouseMove}
              style={{
                width: imageDimensions.width,
                height: imageDimensions.height,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Source"
                className="absolute inset-0 h-full w-full rounded-lg object-cover"
                src={sourceImageUrl}
              />

              {/* Canvas overlay */}
              <canvas
                className="absolute inset-0 rounded-lg"
                key={`canvas-${mode}-${image.id}`}
                ref={canvasRefCallback}
                style={{ cursor: "none" }}
              />

              {/* Brush size preview cursor */}
              {isCanvasReady && cursorPosition && (
                <div
                  className="pointer-events-none absolute rounded-full border-2"
                  style={{
                    width: brushSize,
                    height: brushSize,
                    left: cursorPosition.x - brushSize / 2,
                    top: cursorPosition.y - brushSize / 2,
                    borderColor:
                      mode === "remove"
                        ? "rgb(239, 68, 68)"
                        : "rgb(34, 197, 94)",
                    backgroundColor:
                      mode === "remove"
                        ? "rgba(239, 68, 68, 0.2)"
                        : "rgba(34, 197, 94, 0.2)",
                  }}
                />
              )}

              {/* Canvas loading indicator */}
              {!isCanvasReady && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30">
                  <IconLoader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-white/10 border-t bg-black/50 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-3">
          {mode === "remove" ? (
            <>
              <p className="text-white/70">
                Draw on the object you want to remove
              </p>
              <Button
                className="min-w-[120px] gap-2 bg-red-500 hover:bg-red-600"
                disabled={
                  isProcessing || !isCanvasReady || canvasHistory.length === 0
                }
                onClick={handleSubmit}
              >
                {isProcessing ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <IconSparkles className="h-4 w-4" />
                    Remove
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <p className="text-white/70">
                Draw on the area where you want to add the object
              </p>
              <Button
                className="min-w-[120px] gap-2 bg-green-500 hover:bg-green-600"
                disabled={
                  isProcessing || !isCanvasReady || canvasHistory.length === 0
                }
                onClick={handleSubmit}
              >
                {isProcessing ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <IconSparkles className="h-4 w-4" />
                    Add Object
                  </>
                )}
              </Button>
            </>
          )}
        </div>

        {error && (
          <p className="mt-2 text-center text-red-400 text-sm">{error}</p>
        )}

        <p className="mt-2 text-center text-white/50 text-xs">
          {mode === "remove"
            ? "The AI will fill the marked area with seamless background."
            : "The AI will add the object matching the room's style."}
        </p>
      </div>

      {/* Object description dialog */}
      <AlertDialog
        onOpenChange={(open) => {
          setShowObjectDescriptionDialog(open);
          if (!open) {
            // Clear description when dialog closes (cancel, escape, or outside click)
            setObjectDescription("");
          }
        }}
        open={showObjectDescriptionDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              What object(s) are you removing?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Describe what you&apos;ve marked for removal (e.g., &quot;3 wall
              mounted pictures&quot;, &quot;pet on sofa&quot;, &quot;framed
              picture&quot;).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              autoFocus
              className="w-full"
              onChange={(e) => setObjectDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && objectDescription.trim()) {
                  handleConfirmObjectDescription();
                }
              }}
              placeholder="e.g., 3 wall mounted pictures, pet on sofa"
              value={objectDescription}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              disabled={!objectDescription.trim()}
              onClick={handleConfirmObjectDescription}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Object refinement dialog for Add mode */}
      <AlertDialog
        onOpenChange={(open) => {
          setShowObjectRefinementDialog(open);
          if (!open) {
            // Reset object details when dialog closes
            setObjectDetails({
              name: "",
              size: "medium",
              style: "",
              color: "",
            });
          }
        }}
        open={showObjectRefinementDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Describe the object to add</AlertDialogTitle>
            <AlertDialogDescription>
              Provide details to help the AI add the perfect object
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="mb-1.5 block font-medium text-sm text-white/90">
                Object name
              </label>
              <Input
                autoFocus
                className="w-full"
                onChange={(e) =>
                  setObjectDetails({ ...objectDetails, name: e.target.value })
                }
                placeholder="e.g., armchair, floor lamp, coffee table"
                value={objectDetails.name}
              />
            </div>
            <div>
              <label className="mb-1.5 block font-medium text-sm text-white/90">
                Size
              </label>
              <Select
                onValueChange={(v: "small" | "medium" | "large") =>
                  setObjectDetails({ ...objectDetails, size: v })
                }
                value={objectDetails.size}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block font-medium text-sm text-white/90">
                Style (optional)
              </label>
              <Input
                className="w-full"
                onChange={(e) =>
                  setObjectDetails({ ...objectDetails, style: e.target.value })
                }
                placeholder="e.g., modern, vintage, minimalist"
                value={objectDetails.style}
              />
            </div>
            <div>
              <label className="mb-1.5 block font-medium text-sm text-white/90">
                Color (optional)
              </label>
              <Input
                className="w-full"
                onChange={(e) =>
                  setObjectDetails({ ...objectDetails, color: e.target.value })
                }
                placeholder="e.g., white, dark wood, black"
                value={objectDetails.color}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-500 hover:bg-green-600"
              disabled={!objectDetails.name.trim()}
              onClick={handleConfirmAddObject}
            >
              Add Object
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Replace versions confirmation dialog */}
      <AlertDialog onOpenChange={setShowReplaceDialog} open={showReplaceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace newer versions?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;re editing version {currentVersion}. This will replace{" "}
              {latestVersion - currentVersion === 1
                ? `version ${latestVersion}`
                : `versions ${currentVersion + 1} through ${latestVersion}`}
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSubmitData(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={handleConfirmReplace}
            >
              Replace &amp; Edit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
