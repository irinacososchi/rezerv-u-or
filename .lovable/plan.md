Mărire și centrare imagine sală pe mobil în /panou/sali

## Scop
În cardul de sală din panoul proprietarului (`/panou/sali`), imaginea de copertă este acum prea mică (80×80 px) și aliniată la stânga pe mobil. Vrem să fie vizibil mai mare și centrată în card.

## Modificări propuse
1. Fișier: `src/routes/panou.sali.index.tsx`
   - Mărim containerul imaginii pe mobil (de ex. la 128×128 px sau similar, proporțional), păstrând dimensiunea actuală pe desktop.
   - Centrăm containerul imaginii în card pe mobil (`mx-auto` sau `self-center` în layout-ul `flex-col`).
   - Păstrăm comportamentul desktop: imaginea rămâne la stânga, alăturată textului (`md:flex-row md:items-center`).
   - Păstrăm `object-cover` și fallback-ul cu initiale.

2. Verificare vizuală
   - Deschidem preview-ul pe mobile viewport.
   - Confirmăm că imaginea este centrată și mai mare, fără să rupă layout-ul desktop.

## Nu modificăm
- Logica de date (rooms, cover, pricing, etc.).
- Alte componente sau pagini.
- Desktop layout-ul.
