# Add drag & drop to RoomPhotosUploader

## Goal
Add native drag-and-drop file upload to the existing `RoomPhotosUploader` component without changing its upload logic, compression, or storage/DB handling. Click-to-select remains unchanged.

## What will change
File: `src/components/owner/room-photos-uploader.tsx`

1. Add local state: `const [isDragging, setIsDragging] = useState(false);`

2. Wrap the upload trigger area (the top-right button + hidden input, or the whole card header) in a drop-zone div.

3. Add native drag handlers:
   - `onDragOver`: `e.preventDefault(); setIsDragging(true);`
   - `onDragLeave`: `setIsDragging(false);`
   - `onDrop`: `e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files);`

4. Add a drop-zone visual state shown when `isDragging` is true (inside the wrapped area or in place of the empty-state hint):
   - Dashed border with primary color (`border-primary border-dashed`).
   - Subtle background highlight (`bg-primary/5`).
   - Text: "Trage pozele aici" plus an icon (e.g. `Upload` or `ImageIcon`).
   - Subtext: "JPG, PNG sau WEBP" to match the input `accept` attribute.

5. Keep the existing `Adaugă poze` button and hidden `<input type="file" multiple>` as the fallback click-to-select path.

6. Do NOT change: `handleFiles`, `compressImage`, `uploadPendingPhotos`, pending/edit mode logic, previews, delete, cover selection, or storage/DB paths.

## Verification
- After the change, in both `/panou/sali/nou` and `/panou/sali/$id/edit`, dragging image files onto the drop zone triggers the same validation, compression, and upload as clicking `Adaugă poze`.
- Hovering files over the zone shows the highlighted state.
- The click-to-select button still works.
- Run `bun run build` to confirm the build passes.
