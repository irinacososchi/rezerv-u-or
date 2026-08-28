# Fix întârzierea de 60–120s la login și erorile de „lock" din auth

## Ce am verificat (nu e ce părea)

`src/components/site-footer.tsx` are 30 de linii, doar linkuri: fără `useEffect`, fără import de Supabase, fără `getUser()`. Nu poate provoca bucla și nu are legătură cu login-ul.

Cauza reală, confirmată în cod: **prea multe apeluri `supabase.auth.getUser()` concurente**, fiecare dintre ele făcând un request de rețea către `/auth/v1/user` **în timp ce ține lock-ul global gotrue-js**. La o singură încărcare de pagină se pornesc, în paralel:

- `site-header.tsx:32` — `getUser()` la montare și din nou la fiecare eveniment de auth
- ruta curentă (ex. `sali.$slug.tsx:505`, `panou.dashboard.tsx:117`, `cont.index.tsx:60`, `panou.cereri.tsx:192`, `panou.sali.$id.calendar.tsx` × 3 …) — încă un `getUser()`
- `use-favorites.ts:109` — încă unul
- plus 6 abonamente separate `onAuthStateChange` (`site-header`, `use-user-role`, `use-notifications`, `use-favorites`, `use-auth`, `external-client`), fiecare declanșând propriile refetch-uri la același eveniment

Când rețeaua e lentă sau un request eșuează („Failed to fetch" apare în log-urile de rețea), apelul care ține lock-ul depășește 5000 ms → `Lock was not released within 5000ms... Forcefully acquiring the lock` → apelurile vecine primesc `AbortError: Lock broken by another request` și **eșuează silențios**. De aceea antetul rămâne pe starea „nelogat" și datele sălii nu se încarcă, deși sesiunea există.

`getSession()` citește din localStorage și nu face rețea (decât dacă token-ul e expirat); `getUser()` face mereu rețea. Acesta e nucleul problemei.

## Modificări propuse

1. **O singură sursă de adevăr pentru auth**
   - `src/hooks/use-auth.ts` devine context real: `AuthProvider` (un singur `getSession()` + un singur `onAuthStateChange`) montat în `src/routes/__root.tsx`, iar `useAuth()` citește din context.
   - Hook-ul expune `session`, `user`, `userId`, `loading`.

2. **Eliminarea apelurilor `getUser()` din UI**
   - `site-header.tsx`: folosește `useAuth()` în loc de `getUser()`; profilul și numărul de rezervări se încarcă doar când `userId` se schimbă. Se elimină abonamentul propriu `onAuthStateChange`.
   - `use-user-role.ts`, `use-notifications.ts`, `use-favorites.ts`: iau `userId` din `useAuth()`; își elimină `getSession()`/`getUser()` proprii și abonamentele duplicate.
   - Rutele care apelează `getUser()` doar ca să afle cine e utilizatorul (`sali.$slug`, `rezerva.$slug`, `rezervari`, `cont.index`, `cont.favorite`, `panou.*`, `room-form-page`, `room-photos-uploader`, `ClientFormDialog`) trec pe `useAuth()`/`getSession()`. Rămâne `getUser()` doar acolo unde chiar e nevoie de revalidare la server — nicăieri în aceste ecrane de citire.

3. **Curățenie**
   - Se scoate `console.log("Auth state change: ...")` din `external-client.ts` (log în producție) și abonamentul de acolo.
   - Erorile de rețea la citirea sesiunii nu mai duc la starea „nelogat": se păstrează ultima sesiune cunoscută și se loghează eroarea.

Nu se modifică backend, RLS, schema, pagina de login sau fluxul de rezervare.

## Detalii tehnice

- Lock-ul gotrue-js e per client Supabase, la nivel de tab (Web Locks API). Serializarea apelurilor de auth într-un singur consumator elimină contenția, deci și mesajele `Lock was not released within 5000ms` și `AbortError`.
- Numărul de request-uri `/auth/v1/user` la o încărcare de pagină scade de la ~4–8 la 0 (doar refresh-ul automat de token rămâne).
- `onAuthStateChange` din provider filtrează la `SIGNED_IN` / `SIGNED_OUT` / `USER_UPDATED`, ca `TOKEN_REFRESHED` și `INITIAL_SESSION` să nu declanșeze refetch-uri în lanț.

## Verificare

1. Build fără erori.
2. Login pe desktop Chrome: starea autentificată apare în antet în < 2s, fără erori de lock în consolă.
3. În tab-ul Network, la încărcarea paginii principale nu mai apar apeluri multiple `/auth/v1/user`.
4. Datele sălii înscrise se încarcă în panou imediat după login.
