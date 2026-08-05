# Buton de autentificare pe mobil

## Ce am verificat

În header (`src/components/site-header.tsx`), pentru un vizitator fără cont se afișează două butoane: „Autentificare” și „Creează cont”.

Butonul „Autentificare” are clasa `hidden lg:inline-flex`, deci **apare doar pe desktop**. Pe telefon vizitatorul vede doar „Creează cont” — nu există niciun buton de autentificare, nici în bara de sus, nici în meniul hamburger (meniul extins folosește exact aceleași butoane).

Observație secundară: există o funcție `mobileNavLinks` definită dar nefolosită, iar linkul „Rezervarea mea” este și el ascuns pe mobil (`hidden lg:inline-flex`).

## Ce propun

1. Elimin `hidden lg:inline-flex` de pe butonul „Autentificare” astfel încât să apară și pe telefon, lângă „Creează cont”.
2. Pentru ca cele două butoane să încapă pe ecrane mici: text mai compact pe mobil (padding/dimensiune redusă, `size="sm"` sub `lg`), păstrând aspectul actual pe desktop.
3. Opțional (spune-mi dacă îl vrei): afișez și linkul „Rezervarea mea” pe mobil, în meniul hamburger, folosind funcția `mobileNavLinks` care acum e nefolosită.

## Detalii tehnice

- Fișier: `src/components/site-header.tsx`, blocul `userActions` (ramura `!loading && !user`).
- Modificare doar de prezentare; nu se schimbă logica de autentificare sau rutele `/login` și `/signup`.
