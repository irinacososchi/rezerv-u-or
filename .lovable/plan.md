# Bucla de login pe mobil în panoul de chiriaș — raport

## Cum e păzită autentificarea azi (nu există route guard)

Nu există `beforeLoad`, loader sau layout `_authenticated`. Rutele `/panou/*` sunt publice; paza se face în componente, prin `useEffect` + `supabase.auth.getUser()`.

1. `src/components/owner-layout.tsx` (liniile 100-131) — wrapper-ul panoului:
```
const { data: { user } } = await supabase.auth.getUser();
if (!user) { navigate({ to: "/login" }); return; }
... fetch profiles ...
catch (err) { navigate({ to: "/login" }); }
```
2. `src/routes/panou.orarul-meu.tsx` (liniile 92-105) — al doilea gard, identic:
```
const { data: { user: u } } = await supabase.auth.getUser();
if (!u) { navigate({ to: "/login" }); return; }
```
3. `src/components/clients/ClientList.tsx` (liniile 36-41) — al treilea gard (folosit de `/panou/clienti-chirias` și `/panou/clienti-proprietar`):
```
const { data: { user } } = await supabase.auth.getUser();
if (!user) { navigate({ to: "/login" }); return; }
```
4. `src/hooks/use-user-role.ts` și `src/hooks/use-notifications.ts` cheamă și ele `getUser()` la montare (rolul NU redirecționează; are `loading` propriu și e respectat de sidebar).

## Răspuns la întrebări

- Gardurile **așteaptă** (`await getUser()`), deci nu redirecționează într-o stare „loading" sincronă. Nu există aici bug-ul clasic „redirect while loading".
- Rolul (`use-user-role`) **nu** provoacă redirect; doar ascunde/afișează itemi de meniu.
- Deci ipoteza „guard rulează înainte de restaurarea sesiunii" nu se confirmă.

## Cauza reală probabilă: curse între apeluri `getUser()` paralele fără Web Locks

`getUser()` NU citește local — face un request de rețea la `/auth/v1/user`, iar dacă access-token-ul e expirat declanșează întâi un refresh cu rotația refresh-token-ului.

La deschiderea `/panou/orarul-meu` pornesc **4 apeluri `getUser()` simultan** (owner-layout, pagina, use-user-role, use-notifications); la `/panou/clienti-*` tot 4 (ClientList în loc de pagină). Supabase-js serializează refresh-ul prin `navigator.locks`; Samsung Internet nu expune Web Locks în multe versiuni, deci se face fallback fără lock:

- două refresh-uri pleacă în paralel cu același refresh token,
- al doilea primește `Invalid Refresh Token: Already Used` (400),
- clientul consideră sesiunea invalidă și o șterge din localStorage,
- `getUser()` întoarce `user: null` → redirect `/login`,
- utilizatorul se loghează din nou, revine în panou, se repetă → **buclă**.

Se potrivește cu toate simptomele: pe desktop (Chrome, cu Web Locks) nu apare; un refresh manual al paginii de multe ori merge (token proaspăt, fără refresh concurent); sesiunea „pare" persistată până la intrarea în panou.

Factor agravant: linkurile din sidebar sunt `<a href>` (nu `<Link>`), deci fiecare navigare în panou e full page load care re-declanșează toate cele 4 apeluri de rețea.

## Ce aș schimba (după aprobare)

1. Un singur punct de adevăr pentru sesiune: gardurile din `owner-layout`, `panou.orarul-meu`, `ClientList`, `use-user-role`, `use-notifications` folosesc `getSession()` (citire locală, fără rețea) în loc de `getUser()`, plus `onAuthStateChange`; nu 4 apeluri paralele de rețea.
2. Redirect doar când sesiunea e clar absentă (`session === null` după rezolvare), niciodată pe eroare de rețea — în `owner-layout` blocul `catch` trimite azi la `/login` chiar și la o eroare de fetch a profilului.
3. Sidebar: `<a href>` → `<Link>`, ca navigarea în panou să nu mai fie full reload.
4. Opțional: un mic wrapper de sesiune (context) folosit de toate paginile de panou, ca gardul să existe într-un singur loc.

## Detalii tehnice

- `getUser()` = network + posibil refresh; `getSession()` = citire din storage cu refresh doar dacă e expirat. Reducerea la un singur consumator elimină cursa indiferent de suportul Web Locks.
- `@supabase/supabase-js` ^2.105.1, `persistSession: true`, `flowType: "implicit"`, storage `localStorage` (`src/integrations/supabase/external-client.ts`).
- Nicio schimbare de backend, RLS sau schemă.
