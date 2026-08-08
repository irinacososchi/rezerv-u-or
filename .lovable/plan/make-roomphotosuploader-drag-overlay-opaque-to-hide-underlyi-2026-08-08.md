Make RoomPhotosUploader drag overlay opaque to hide underlying content

Goal: Stop the empty-state text from showing through the drag overlay by making the overlay background nearly opaque.

Changes in src/components/owner/room-photos-uploader.tsx

1. Change the drag overlay background class from `bg-primary/5` to `bg-background/95` so it cleanly covers the content underneath in both light and dark modes.

2. Remove the `opacity-50` class from `<CardContent>` when dragging, since the near-opaque overlay now covers content properly without needing the dimming.

3. Keep all other overlay styles unchanged: `pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary`, plus the Upload icon and text "Trage pozele aici" / "JPG, PNG sau WEBP".

4. Leave `handleFiles`, `compressImage`, `uploadPendingPhotos`, drag-counter logic, previews, delete, and cover actions completely untouched.

Verification
- Run `bun run build`.
- Visually confirm: during drag, the overlay cleanly covers the content and only "Trage pozele aici" is visible; no underlying text bleeds through.
