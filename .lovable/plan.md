# Ascunde vederea „Săptămână" pe mobil (sub 768px)

## Situația actuală (verificată în cod)

- `panou.sali.$id.calendar.tsx`: switcher-ul mobil (`inline-flex lg:hidden`) include explicit toate cele trei vederi — Zi / Săpt. / Lună. Există un guard, dar rulează doar pe `resize` (nu la montare) și folosește pragul `<1024px`.
- `panou.orarul-meu.tsx`: un singur switcher, fără nicio filtrare responsive; „Săptămână" apare pe orice ecran. Vederea implicită se ia din `localStorage`, deci un „week" salvat anterior rămâne activ și pe telefon.
- Când e selectată, vederea săptămânală chiar se randează pe mobil (grilă `min-w-[760px]` cu scroll orizontal).

## Ce se schimbă

Prag mobil: **sub 768px**. Vedere implicită pe mobil: **Zi**.

### 1. Calendarul sălii (`src/routes/panou.sali.$id.calendar.tsx`)
- Switcher-ul mobil afișează doar **Zi** și **Lună** (se scoate „Săpt." din lista randată sub 768px).
- Guard-ul de vedere se aliniază la 768px, se rulează și la montare (nu doar pe `resize`), și comută pe **Zi** dacă vederea curentă e „week" pe mobil.
- Starea inițială folosește același prag de 768px.

### 2. Orarul meu (`src/routes/panou.orarul-meu.tsx`)
- Se adaugă detecție responsive (hook existent `use-mobile` sau `matchMedia`), aplicată după hidratare pentru a evita nepotriviri SSR.
- Butonul „Săptămână" nu se randează sub 768px.
- Valoarea din `localStorage` este sanitizată: dacă e „week" și ecranul e mobil, se folosește **Zi**; preferința desktop nu se suprascrie inutil.
- Un guard reactiv la schimbarea lățimii comută din „week" în „Zi" când se trece sub prag.

### 3. Randarea vederii
Pe ambele pagini, ramura de randare „week" rămâne neschimbată — pur și simplu nu mai poate fi selectată sub 768px, deci grila de 760px nu mai apare pe telefon.

## Detalii tehnice

- Se folosește un singur prag partajat (768px) în ambele fișiere, pentru consistență.
- Detecția se face în `useEffect` / hook client-side, nu în inițializatorul de `useState`, pentru a evita erori de hidratare.
- Fără modificări de date, RPC-uri sau logică de rezervări — doar prezentare.
