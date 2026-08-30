import { Camera, ImagePlus, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Photo } from "@/lib/types";

/** Compresses to a reasonable size and preserves portrait orientation. */
async function fileToPhoto(file: File): Promise<Photo> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
  return { id: `ph-${Math.random().toString(36).slice(2, 8)}`, url: dataUrl };
}

export function ReferencePhotoUploader({
  photos,
  onChange,
  max = 3,
  withCaptions = false,
  emptyHint,
}: {
  photos: Photo[];
  onChange: (next: Photo[]) => void;
  max?: number;
  withCaptions?: boolean;
  emptyHint?: string;
}) {
  const inputId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    try {
      const room = max - photos.length;
      const picked = Array.from(files).slice(0, Math.max(room, 0));
      if (!picked.length) {
        setError(`You can add up to ${max} photos.`);
        return;
      }
      const next = await Promise.all(picked.map(fileToPhoto));
      onChange([...photos, ...next]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {photos.map((p) => (
          <figure key={p.id} className="w-24">
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-secondary">
              <img src={p.url} alt={p.caption ?? "Reference photo"} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(photos.filter((x) => x.id !== p.id))}
                aria-label="Remove photo"
                className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-background/90 text-foreground shadow-sm"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            {withCaptions && (
              <Input
                value={p.caption ?? ""}
                placeholder="Caption"
                aria-label="Photo caption"
                className="mt-1.5 h-8 text-xs"
                onChange={(e) =>
                  onChange(photos.map((x) => (x.id === p.id ? { ...x, caption: e.target.value } : x)))
                }
              />
            )}
          </figure>
        ))}

        {photos.length < max && (
          <div className="flex w-24 flex-col gap-2">
            <label
              htmlFor={inputId}
              className="grid aspect-[3/4] cursor-pointer place-items-center rounded-xl border border-dashed border-border bg-card text-muted-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <span className="flex flex-col items-center gap-1 text-[11px] font-medium">
                <ImagePlus className="size-5" aria-hidden />
                Add photo
              </span>
            </label>
            <input
              id={inputId}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 text-[11px] sm:hidden"
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="size-3.5" aria-hidden /> Camera
            </Button>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              aria-label="Take a photo"
              onChange={(e) => void handleFiles(e.target.files)}
            />
          </div>
        )}
      </div>
      {emptyHint && photos.length === 0 && <p className="mt-2 text-xs text-muted-foreground">{emptyHint}</p>}
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
