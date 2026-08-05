# Audit: scroll orizontal pe mobil la sălile cu mai multe poze

## Ce am găsit

**1. Unde apar pozele**
- Lista `/sali` (`src/components/room-card.tsx`): un singur `<img>` per card, în `aspect-[4/3] w-full` cu `overflow-hidden`. Datele din `src/data/rooms.ts` reduc pozele la o singură imagine de copertă. Lista NU poate produce overflow.
- Detaliu `/sali/{slug}` (`src/routes/sali.$slug.tsx:830-866`): imagine mare + bandă de miniaturi afișată doar când `photos.length > 1`.

**2. Cum e construită galeria multi-foto**
Fără librărie de carusel. Este un rând flex cu miniaturi de lățime fixă:

```tsx
{photos.length > 1 && (
  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
    {photos.map((p) => (
      <button className="h-20 w-28 flex-shrink-0 overflow-hidden rounded-lg border-2 ...">
```

Lățimea intrinsecă a rândului = `n × 112px + gap-uri`. Cu 4+ poze depășește 393px.

**3. Elementul care depășește viewport-ul**
Nu banda în sine (are `overflow-x-auto`), ci **coloana de grid părinte**: `src/routes/sali.$slug.tsx:826`

```tsx
<div className="mt-6 grid gap-8 lg:grid-cols-[3fr_2fr]">
  <div>   {/* LEFT — conține galeria */}
```

Un grid item are implicit `min-width: auto`, deci pista se dimensionează după conținutul intrinsec (rândul de miniaturi), nu după viewport. `overflow-x-auto` nu se activează pentru că părintele îi acordă toată lățimea cerută. Coloana crește peste 100vw → se lățește `container`-ul → pagina scrolează lateral și toate celelalte secțiuni se deplasează.

**4. Constrângeri lipsă**
- Coloana stângă (`<div>` de la linia 828) și wrapper-ul grid nu au `min-w-0`.
- `PageShell` (linia 1582) și `main`/`container` nu au `overflow-x-hidden`.
- Imaginea mare e corectă (`h-full w-full object-cover` în container `overflow-hidden`).

**5. Imagini**
Imaginile din miniaturi sunt responsive (`h-full w-full object-cover`); problema e lățimea fixă `w-28` pe butoanele-container combinată cu `flex-shrink-0`.

**6. De ce single-photo merge**
Cu o singură poză blocul `photos.length > 1` nu se randează, deci nu există niciun element cu lățime intrinsecă mare, iar coloana se dimensionează normal după viewport.

## Remediere propusă (la aprobare)

1. `src/routes/sali.$slug.tsx:826-828` — adaugă `min-w-0` pe coloana stângă (și pe cea dreaptă, preventiv), astfel încât `overflow-x-auto` al benzii de miniaturi să funcționeze efectiv.
2. Opțional, ca plasă de siguranță: `overflow-x-hidden` pe `main` în `PageShell`.
3. Fără modificări de date sau de logică; doar clase de layout.
