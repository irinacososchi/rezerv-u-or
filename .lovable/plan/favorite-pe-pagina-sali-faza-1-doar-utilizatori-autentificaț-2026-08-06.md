# Favorite pe pagina /sali (Faza 1 — doar utilizatori autentificați)

Extindem infrastructura existentă de favorite (tabel `favorites`, toggle pe pagina sălii, pagina /cont/favorite) la lista de săli: inimioară pe fiecare card, sortare cu favoritele primele și un filtru „Favorite”.

## 1. Hook comun: `src/hooks/use-favorites.ts` (nou)

- La montare: citește utilizatorul curent; dacă e autentificat, încarcă `room_id` din `favorites` unde `renter_id = auth.uid()` într-un `Set<string>`.
- Expune: `favorites` (Set), `isFavorite(roomId)`, `toggleFavorite(roomId)`, `loading`, `isLoggedIn`.
- `toggleFavorite`: update optimist în Set, apoi insert (`renter_id`, `room_id`) sau delete după `renter_id` + `room_id`; la eroare face rollback și loghează.
- Delogat: Set gol, `isFavorite` → false, `toggleFavorite` → no-op (Faza 2 va adăuga localStorage).
- Erorile de query nu aruncă: se întoarce set gol, lista nu se rupe.

## 2. Inimioară pe card: `src/components/room-card.tsx`

- Props opționale noi: `isFavorite?: boolean`, `onToggleFavorite?: (roomId: string) => void`.
- Butonul se randează doar dacă `onToggleFavorite` e furnizat — restul utilizărilor RoomCard rămân neschimbate.
- Poziție: `absolute right-3 top-3 z-10` în interiorul wrapper-ului de imagine (unde stă deja badge-ul „Inactivă” în stânga).
- Icon `Heart` din lucide-react: umplut/teal când e favorit, contur altfel; buton rotund semi-transparent cu blur, `aria-label` „Adaugă la favorite” / „Elimină de la favorite”.
- `onClick` face `e.preventDefault()` + `e.stopPropagation()` ca să nu navigheze.

## 3. Pagina listă: `src/routes/sali.index.tsx`

- Folosește `useFavorites()`.
- Stare nouă `onlyFavorites`; adăugată în logica `filtered` (când e bifat, păstrează doar sălile favorite) și în `reset()`.
- `useMemo` nou `sorted` după `filtered`: sortare stabilă cu favoritele primele (ordinea relativă existentă se păstrează în fiecare grup). Randarea și starea „niciun rezultat” folosesc `sorted`.
- Fiecare `RoomCard` primește `isFavorite={isFavorite(r.id)}` și `onToggleFavorite={toggleFavorite}`.
- Checkbox „Favorite” cu iconiță mică de inimă, lângă checkbox-urile de dotări în aside-ul din stânga.
- Inimioarele și checkbox-ul se afișează întotdeauna; delogat sunt pur și simplu inactive (Faza 2).

## Neatins

Tabelul `favorites` și RLS, pagina de detaliu a sălii, /cont/favorite, suportul pentru vizitatori.
