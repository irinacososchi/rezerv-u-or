# Reordonare poze prin drag & drop (RoomPhotosUploader)

## Ce se schimbă pentru utilizator

- Pozele sălii pot fi rearanjate trăgându-le cu mouse-ul/degetul, atât la o sală nouă cât și la editarea uneia existente.
- Prima poză din ordine este întotdeauna poza principală (badge „Principală").
- Butonul „Setează principală" mută poza pe prima poziție, în loc să bifeze doar un marcaj.
- La editare, noua ordine se salvează imediat; după reîncărcarea paginii ordinea rămâne.
- Încărcarea prin tragerea fișierelor din calculator, ștergerea și compresia rămân neschimbate.

## Implementare

Pachete noi: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

Fișier principal: `src/components/owner/room-photos-uploader.tsx`.

1. **Componentă card sortabil** — extrag conținutul unui card într-un `SortablePhotoCard` care folosește `useSortable({ id })` și aplică `CSS.Transform` + `transition`, `attributes`/`listeners` pe rădăcina cardului, cu `opacity`/`ring` în timpul dragului. Copiii (imagine, badge, butoane) rămân identici ca acum.
2. **Context DnD** — un singur `DndContext` cu `PointerSensor` configurat `activationConstraint: { distance: 8 }` (click-urile pe butoane rămân funcționale) plus `KeyboardSensor`, `closestCenter`, și `SortableContext` cu `rectSortingStrategy` peste grila existentă. Id-uri: `_key` în mod pending, `id` în mod edit.
3. **Mod pending** — `onDragEnd` face `arrayMove` pe lista locală, apoi remapează `is_cover: i === 0` și trimite prin `onPendingChange`. `setPendingCover` devine „mută la index 0" (`arrayMove(list, idx, 0)` + resincronizare `is_cover`). `uploadPendingPhotos` rămâne neschimbat — scrie deja `sort_order: i` după ordinea array-ului, deci ordinea și coperta se persistă corect.
4. **Mod edit** — `onDragEnd` aplică `arrayMove` optimist pe state, apoi un helper `persistOrder(next)` care rulează pentru fiecare poză `update({ sort_order: index, is_cover: index === 0 }).eq("id", ...)` (Promise.all). La eroare: revine la ordinea anterioară + `toast.error`. `setCover(photo)` devine mutare la index 0 urmată de `persistOrder`. Badge-ul „Principală" și ascunderea butonului se bazează pe index 0, nu pe flag.
5. **Protecția zonei de fișiere** — în `onDragEnter`/`onDragOver`/`onDrop` adaug `if (!e.dataTransfer?.types?.includes("Files")) return;` ca dragul intern să nu declanșeze overlay-ul „Trage pozele aici".
6. **`src/data/rooms.ts`** — `pickImage` are deja fallback pe cea mai mică `sort_order`; îl las funcțional și mă asigur că ordinea de fallback rămâne ascendentă după `sort_order`. Nu sunt necesare modificări de schemă.

Rămân neatinse: `handleFiles`, `compressImage`, `uploadPendingPhotos`, validările, ștergerea pozelor.

## Verificare

Build după implementare; verific manual reordonarea în ambele moduri, persistența după reload la editare, funcționarea butoanelor de ștergere/principală și încărcarea prin drop de fișiere.
