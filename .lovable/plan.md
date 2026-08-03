# Plan: Curățare log-uri temporare de diagnostic

## Obiectiv
Elimină toate declarațiile `console.log` adăugate temporar pentru depanarea fluxului de aprobare a seriilor recurente, păstrând fixurile reale (`type="button"` și `e?.preventDefault()`).

## Fișiere afectate

### 1. `src/components/owner/recurring-group-card.tsx`
- Elimină `console.log("APROBA TOT CLICKED", groupId);` din `handleApproveAll`.
- Păstrează `type="button"` pe toate butoanele.
- Păstrează `e?.preventDefault()` în handlere.

### 2. `src/routes/panou.cereri.tsx`
- Elimină `console.log("BULK UPDATE running", filter, newStatus);` din `bulkUpdateStatus`.
- Elimină `console.log("onApproveAll PROP CALLED", gid);` din ambele callback-uri `onApproveAll` (desktop și mobile).
- Elimină `console.log("onApproveAll THREW", err);` din ambele callback-uri `onApproveAll` (desktop și mobile).
- Păstrează logica de bulk update și trimitere email.

### 3. `src/routes/panou.dashboard.tsx`
- Elimină `console.log("BULK UPDATE running (dashboard)", filter, newStatus);` din `bulkUpdateStatus`.
- Elimină `console.log("onApproveAll PROP CALLED", gid);` din callback-ul `onApproveAll` al cardului recurent.
- Elimină `console.log("onApproveAll THREW", err);` din același callback.
- Păstrează logica de bulk update și trimitere email.

## Verificare
După editare, rulează build-ul pentru a confirma că nu există erori de sintaxă sau de tip.
