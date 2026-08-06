# Faza 2 favorite: vizitatori (localStorage) + migrare la cont

Extindem doar `src/hooks/use-favorites.ts`. Pagina `/sali` și `room-card.tsx` rămân neschimbate — `isFavorite` / `toggleFavorite` funcționează identic pentru vizitatori și utilizatori logați.

## Ce se schimbă

### 1. Suport vizitatori (localStorage)
- Cheie `rzrv-favorites`, valoare = array JSON de `room_id`.
- La montare, dacă nu există sesiune: se încarcă lista din localStorage în starea locală.
- `toggleFavorite` pentru vizitator: actualizează starea imediat și scrie lista în localStorage. Fără apeluri la bază.
- Citire/scriere protejate cu try/catch și verificare `typeof window` (SSR), cu fallback pe listă goală dacă valoarea salvată e coruptă.

### 2. Migrare la autentificare
- Ne abonăm la schimbările de stare de autentificare (`supabase.auth.onAuthStateChange`) în hook, o singură dată.
- La tranziția spre „logat" (SIGNED_IN / sesiune inițială cu user), dacă localStorage conține favorite:
  - se citesc favoritele existente din cont;
  - se inserează doar cele care lipsesc (deduplicare, deci fără erori de cheie duplicată);
  - la succes se golește localStorage și se reîncarcă setul din cont (inimioarele reflectă setul unit).
- Dacă migrarea eșuează: se loghează eroarea, localStorage **rămâne** intact, autentificarea nu e blocată.
- Guard: migrarea rulează doar dacă există elemente în localStorage și se marchează ca rulată pentru sesiunea curentă (ref intern), deci nu se repetă la refresh de token.

### 3. La deconectare
- Setul din cont se golește; hook-ul revine pe sursa localStorage (care e goală după migrare).

## Detalii tehnice
- Fișier atins: `src/hooks/use-favorites.ts`. Fără modificări de schemă, tabel sau RLS.
- Se păstrează API-ul returnat: `{ favorites, isFavorite, toggleFavorite, loading, isLoggedIn }`.
- Comportamentul Faza 1 (insert/delete direct în `favorites`) rămâne identic pentru utilizatorii logați.
- Cleanup corect al abonamentului auth și al flag-ului `cancelled` la demontare.

## Verificare după build
- Delogat: inimioarele persistă după reîncărcarea paginii.
- Delogat → favorite → login: favoritele apar în cont, localStorage golit.
- Fără duplicate dacă camera era deja favorită în cont.
- localStorage gol la login: nicio operație.
