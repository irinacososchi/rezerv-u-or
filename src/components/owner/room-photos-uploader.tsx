import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/external-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, Trash2, Star, ImageIcon } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "room-photos";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DIMENSION = 1920;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export type RoomPhoto = {
  id: string;
  storage_url: string;
  is_cover: boolean;
  sort_order: number;
};

export type PendingPhoto = {
  _key: string;
  file: File;
  blob: Blob;
  previewUrl: string;
  is_cover: boolean;
};

function extractStoragePath(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

function newKey() {
  return Math.random().toString(36).slice(2);
}

async function compressImage(file: File): Promise<Blob> {
  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const quality = 0.85;
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  return await new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), outputType, quality);
  });
}

/**
 * Upload pending photos for a room that was just created.
 * Returns true if all uploads succeeded.
 */
export async function uploadPendingPhotos(
  roomId: string,
  userId: string,
  pending: PendingPhoto[],
): Promise<boolean> {
  if (pending.length === 0) return true;
  let allOk = true;
  for (let i = 0; i < pending.length; i++) {
    const p = pending[i];
    try {
      const ext = p.blob.type === "image/png" ? "png" : "jpg";
      const path = `${userId}/${roomId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, p.blob, { contentType: p.blob.type, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { error: insErr } = await supabase.from("room_photos").insert({
        room_id: roomId,
        storage_url: pub.publicUrl,
        is_cover: p.is_cover,
        sort_order: i,
      });
      if (insErr) throw insErr;
    } catch (err) {
      console.error(err);
      allOk = false;
    }
  }
  return allOk;
}

type Props = {
  roomId?: string;
  pending?: PendingPhoto[];
  onPendingChange?: (next: PendingPhoto[]) => void;
};

export function RoomPhotosUploader({ roomId, pending, onPendingChange }: Props) {
  const isPendingMode = !roomId;
  const [photos, setPhotos] = useState<RoomPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadPhotos() {
    if (!roomId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("room_photos")
      .select("id, storage_url, is_cover, sort_order")
      .eq("room_id", roomId)
      .order("sort_order", { ascending: true });
    setLoading(false);
    if (error) {
      console.error(error);
      return;
    }
    setPhotos((data ?? []) as RoomPhoto[]);
  }

  useEffect(() => {
    void loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);

    if (isPendingMode) {
      const next: PendingPhoto[] = [...(pending ?? [])];
      for (const file of Array.from(files)) {
        if (!ACCEPTED.includes(file.type)) {
          toast.error(`${file.name}: format nesuportat (JPG, PNG sau WEBP).`);
          continue;
        }
        if (file.size > MAX_BYTES * 4) {
          toast.error(`${file.name}: prea mare (max 20MB).`);
          continue;
        }
        try {
          const blob = await compressImage(file);
          if (blob.size > MAX_BYTES) {
            toast.error(`${file.name}: după compresie tot e peste 5MB.`);
            continue;
          }
          next.push({
            _key: newKey(),
            file,
            blob,
            previewUrl: URL.createObjectURL(blob),
            is_cover: next.length === 0,
          });
        } catch (err) {
          console.error(err);
          toast.error(`${file.name}: procesare eșuată.`);
        }
      }
      onPendingChange?.(next);
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Trebuie să fii autentificat.");
      setUploading(false);
      return;
    }

    let uploaded = 0;
    let failed = 0;
    for (const file of Array.from(files)) {
      if (!ACCEPTED.includes(file.type)) {
        toast.error(`${file.name}: format nesuportat (JPG, PNG sau WEBP).`);
        failed++;
        continue;
      }
      if (file.size > MAX_BYTES * 4) {
        toast.error(`${file.name}: prea mare (max 20MB).`);
        failed++;
        continue;
      }
      try {
        const blob = await compressImage(file);
        if (blob.size > MAX_BYTES) {
          toast.error(`${file.name}: după compresie tot e peste 5MB.`);
          failed++;
          continue;
        }
        const ext = blob.type === "image/png" ? "png" : "jpg";
        const path = `${user.id}/${roomId}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, { contentType: blob.type, upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const nextSort =
          (photos.length === 0 ? 0 : Math.max(...photos.map((p) => p.sort_order)) + 1) +
          uploaded;
        const isCover = photos.length === 0 && uploaded === 0;
        const { error: insErr } = await supabase.from("room_photos").insert({
          room_id: roomId,
          storage_url: pub.publicUrl,
          is_cover: isCover,
          sort_order: nextSort,
        });
        if (insErr) throw insErr;
        uploaded++;
      } catch (err) {
        console.error(err);
        toast.error(`${file.name}: încărcare eșuată.`);
        failed++;
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (uploaded > 0) toast.success(`${uploaded} poză(e) adăugată(e).`);
    if (failed > 0 && uploaded === 0) toast.error("Nicio poză nu a fost încărcată.");
    await loadPhotos();
  }

  async function setCover(photo: RoomPhoto) {
    if (!roomId || photo.is_cover) return;
    setBusyId(photo.id);
    await supabase.from("room_photos").update({ is_cover: false }).eq("room_id", roomId);
    const { error } = await supabase
      .from("room_photos")
      .update({ is_cover: true })
      .eq("id", photo.id);
    setBusyId(null);
    if (error) {
      toast.error("Nu am putut seta poza principală.");
      return;
    }
    toast.success("Poză principală actualizată.");
    await loadPhotos();
  }

  async function removePhoto(photo: RoomPhoto) {
    if (!window.confirm("Sigur ștergi această poză?")) return;
    setBusyId(photo.id);
    const path = extractStoragePath(photo.storage_url);
    if (path) {
      await supabase.storage.from(BUCKET).remove([path]);
    }
    const { error } = await supabase.from("room_photos").delete().eq("id", photo.id);
    if (!error && photo.is_cover) {
      const remaining = photos.filter((p) => p.id !== photo.id);
      if (remaining.length > 0) {
        await supabase
          .from("room_photos")
          .update({ is_cover: true })
          .eq("id", remaining[0].id);
      }
    }
    setBusyId(null);
    if (error) {
      toast.error("Nu am putut șterge poza.");
      return;
    }
    toast.success("Poză ștearsă.");
    await loadPhotos();
  }

  function setPendingCover(key: string) {
    const next = (pending ?? []).map((p) => ({ ...p, is_cover: p._key === key }));
    onPendingChange?.(next);
  }

  function removePending(key: string) {
    const target = (pending ?? []).find((p) => p._key === key);
    if (target) URL.revokeObjectURL(target.previewUrl);
    let next = (pending ?? []).filter((p) => p._key !== key);
    if (target?.is_cover && next.length > 0) {
      next = next.map((p, i) => ({ ...p, is_cover: i === 0 }));
    }
    onPendingChange?.(next);
  }

  const pendingList = pending ?? [];
  const showEmpty = isPendingMode ? pendingList.length === 0 : photos.length === 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Poze sală</CardTitle>
          <p className="text-sm text-muted-foreground">
            JPG, PNG sau WEBP. Max 5MB după compresie. Pozele sunt redimensionate
            automat la max 1920px.
            {isPendingMode && " Vor fi încărcate la salvarea sălii."}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? "Se procesează..." : "Adaugă poze"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">Se încarcă pozele...</div>
        ) : showEmpty ? (
          <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
            <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nicio poză încă. Apasă „Adaugă poze" ca să încarci.
            </p>
          </div>
        ) : isPendingMode ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {pendingList.map((p) => (
              <div
                key={p._key}
                className="relative group rounded-lg overflow-hidden border bg-muted aspect-square"
              >
                <img
                  src={p.previewUrl}
                  alt="Poză sală"
                  className="h-full w-full object-cover"
                />
                {p.is_cover && (
                  <div className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5">
                    <Star className="h-3 w-3 fill-current" />
                    Principală
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!p.is_cover && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setPendingCover(p._key)}
                    >
                      <Star className="h-4 w-4" />
                      Setează principală
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => removePending(p._key)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative group rounded-lg overflow-hidden border bg-muted aspect-square"
              >
                <img
                  src={photo.storage_url}
                  alt="Poză sală"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {photo.is_cover && (
                  <div className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5">
                    <Star className="h-3 w-3 fill-current" />
                    Principală
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!photo.is_cover && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setCover(photo)}
                      disabled={busyId === photo.id}
                    >
                      <Star className="h-4 w-4" />
                      Setează principală
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => removePhoto(photo)}
                    disabled={busyId === photo.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
