import { Camera, ImagePlus, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { attachShopMediaApiV1ShopsShopIdMediaPost } from "@/lib/api/generated/clients/attachShopMediaApiV1ShopsShopIdMediaPost";
import { createUploadApiV1MediaUploadPost } from "@/lib/api/generated/clients/createUploadApiV1MediaUploadPost";
import { removeShopMediaApiV1ShopsShopIdMediaPhotoIdDelete } from "@/lib/api/generated/clients/removeShopMediaApiV1ShopsShopIdMediaPhotoIdDelete";
import { getErrorMessage } from "@/lib/api-client";
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

/** Uploads a file to Supabase Storage via the shop media flow (signed
 * upload URL → PUT bytes → attach to the shop) and returns the real,
 * durable, publicly-viewable photo. */
async function uploadShopPhoto(file: File, shopId: string): Promise<Photo> {
  const extension = file.name.split(".").pop() ?? "jpg";
  const { data: uploadData } = await createUploadApiV1MediaUploadPost({
    body: {
      context: "shop",
      context_id: shopId,
      file_extension: extension,
      media_type: "image",
    },
  });
  const { media_asset_id, upload_url, token } = uploadData.data;

  const putResponse = await fetch(upload_url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type },
    body: file,
  });
  if (!putResponse.ok) throw new Error("Could not upload that photo.");

  const { data: attachData } = await attachShopMediaApiV1ShopsShopIdMediaPost({
    path: { shop_id: shopId },
    body: { media_asset_id },
  });
  return { id: attachData.data.id, url: attachData.data.url };
}

export function ReferencePhotoUploader({
  photos,
  onChange,
  max = 3,
  withCaptions = false,
  emptyHint,
  remote,
}: {
  photos: Photo[];
  onChange: (next: Photo[]) => void;
  max?: number;
  withCaptions?: boolean;
  emptyHint?: string;
  /** When set, photos upload for real (signed upload → attach to the shop)
   * instead of only being previewed locally — used by shop settings only. */
  remote?: { shopId: string };
}) {
  const inputId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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
      if (remote) {
        setUploading(true);
        const next = await Promise.all(
          picked.map((file) => uploadShopPhoto(file, remote.shopId)),
        );
        onChange([...photos, ...next]);
      } else {
        const next = await Promise.all(picked.map(fileToPhoto));
        onChange([...photos, ...next]);
      }
    } catch (e) {
      setError(
        remote
          ? getErrorMessage(e)
          : e instanceof Error
            ? e.message
            : "Upload failed.",
      );
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async (photo: Photo) => {
    if (remote) {
      try {
        await removeShopMediaApiV1ShopsShopIdMediaPhotoIdDelete({
          path: { shop_id: remote.shopId, photo_id: photo.id },
        });
      } catch (e) {
        setError(getErrorMessage(e));
        return;
      }
    }
    onChange(photos.filter((x) => x.id !== photo.id));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {photos.map((p) => (
          <figure key={p.id} className="w-28">
            <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-hairline bg-surface-strong">
              <img
                src={p.url}
                alt={p.caption ?? "Reference photo"}
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={() => void removePhoto(p)}
                aria-label="Remove photo"
                className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-background text-ink shadow-float"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            {withCaptions && (
              <Input
                value={p.caption ?? ""}
                placeholder="Caption"
                aria-label="Photo caption"
                className="mt-2 h-10 text-sm"
                onChange={(e) =>
                  onChange(
                    photos.map((x) => (x.id === p.id ? { ...x, caption: e.target.value } : x)),
                  )
                }
              />
            )}
          </figure>
        ))}

        {photos.length < max && (
          <div className="flex w-28 flex-col gap-2">
            <label
              htmlFor={inputId}
              className="grid aspect-[3/4] cursor-pointer place-items-center rounded-md border border-dashed border-hairline bg-card text-muted-foreground transition-colors hover:border-ink hover:text-ink aria-disabled:pointer-events-none aria-disabled:opacity-50"
              aria-disabled={uploading}
            >
              <span className="flex flex-col items-center gap-1 text-[11px] font-medium">
                <ImagePlus className="size-5" aria-hidden />
                {uploading ? "Uploading…" : "Add photo"}
              </span>
            </label>
            <input
              id={inputId}
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              className="sr-only"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="secondary"
              size="xs"
              className="px-2 sm:hidden"
              disabled={uploading}
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
      {emptyHint && photos.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">{emptyHint}</p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
