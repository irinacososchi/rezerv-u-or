# Fix buclă de login pe mobil (Samsung Internet) în panou

Cauză confirmată: 4 apeluri `getUser()` paralele la deschiderea unei pagini de panou → refresh-uri concurente pe același refresh token (fără Web Locks în Samsung Internet) → „Refresh Token Already Used" → sesiunea e ștearsă local → redirect la `/login` → buclă.

## Modificări

1. `src/components/owner-layout.tsx` (garda din `useEffect`, ~100-131)
   - `supabase.auth.getUser()` → `supabase.auth.getSession()`; se folosește `session.user`.
   - Redirect la `/login` DOAR dacă `session === null` după rezolvare.
   - `catch`: nu mai navighează la `/login`; doar `console.error` + `setChecking(false)` (eroare de rețea sau la citirea profilului nu deloghează).

2. `src/routes/panou.orarul-meu.tsx` (~92-105) — aceeași înlocuire cu `getSession()`; redirect doar când nu există sesiune.

3. `src/components/clients/ClientList.tsx` (~36-41) — aceeași înlocuire; la lipsa sesiunii redirect, la eroare de rețea doar oprire loading.

4. `src/hooks/use-user-role.ts` — `getUser()` → `getSession()` pentru stabilirea `userId` inițial; `onAuthStateChange` rămâne neschimbat.

5. `src/hooks/use-notifications.ts` — `getUser()` → `getSession()` în `fetchAll`; restul logicii neschimbat.

6. Navigație client-side în panou: în `owner-layout.tsx`, itemii din sidebar desktop (`renderItem`) și din meniul burger mobil (`renderMobileItem`) trec de la `<a href>` la `<Link to>` din `@tanstack/react-router` (cu `onClick` de închidere a sheet-ului păstrat). Linkul „Acasă" din burger devine tot `<Link to="/">`. Butonul de logout rămâne cum e.

## Detalii tehnice

- `getSession()` citește din `localStorage` și declanșează refresh doar dacă token-ul e expirat, deci nu mai există 4 refresh-uri concurente; pe desktop comportamentul rămâne identic.
- Tipurile rutelor: `<Link to>` cu căi statice de panou este type-safe (rutele există deja); se elimină `as never`-urile de navigare doar unde nu mai e necesar.
- Fără modificări de backend, RLS, schemă sau pagina de login.

## Verificare

Build după modificări; apoi test: login pe mobil → `/panou/orarul-meu` și `/panou/clienti-chirias` fără redirect; navigare între secțiuni fără reload complet; desktop neschimbat.
