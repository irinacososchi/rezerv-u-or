Fix RoomPhotosUploader drag overlay so the card stays visible

Goal: Stop the drop-zone card from disappearing during drag. The drag overlay should be a purely visual layer on top of the existing content, not a replacement.

Changes in src/components/owner/room-photos-uploader.tsx

1. Revert the conditional unmounting of CardContent.
   - Always render <CardContent> with its normal children (empty hint or photo grid).
   - The empty hint "Nicio poză încă..." and the photo grid stay mounted while dragging.

2. Keep the drag overlay as a separate absolute layer.
   - Position: `absolute inset-0 z-10` inside the relative drop-zone container.
   - Style: `border-2 border-dashed border-primary bg-primary/5`, centered content, icon + text "Trage pozele aici" + "JPG, PNG sau WEBP".
   - Add `pointer-events-none` so the overlay never steals drag events from the container.

3. Keep the drag-counter logic in place.
   - `dragCounter` ref with increment on `onDragEnter`, decrement on `onDragLeave`, reset on `onDrop`.
   - `onDragOver` only prevents default; `setIsDragging` is toggled by enter/leave counter.

4. Optional: dim the underlying content to ~50% opacity while dragging so the overlay contrast is cleaner, but keep it rendered.

5. Leave `handleFiles`, `compressImage`, `uploadPendingPhotos`, Storage/DB logic, previews, delete, and cover actions completely untouched.

Verification
- Run `bun run build`.
- Visually confirm: during drag the card stays visible and the overlay appears on top; no layout collapse, no flicker, drop still calls handleFiles.
