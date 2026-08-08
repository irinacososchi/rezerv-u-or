# Actualizare pagini legale (Cookies, Confidențialitate, Termeni)

## Obiectiv
Înlocuiește conținutul celor trei pagini legale cu textul revizuit din documentele încărcate, păstrând rutele, layout-ul și componentele existente.

## Modificări

### 1. `/politica-cookies` — `src/routes/politica-cookies.tsx`
- Adaugă secțiunea nouă **2.2. Analiză de trafic (fără cookie-uri)**: măsurare agregată (vizitatori, pagini, sursă, dispozitiv, țară estimată din fusul orar), fără profiluri, fără identificatori pe dispozitiv, deci fără banner de consimțământ.
- Renumerotează fosta „2.2. Ce NU folosim" în **2.3**.
- Actualizează nota finală: reflectă analiza de trafic fără cookie-uri și condițiile în care ar fi nevoie de banner.
- Actualizează și descrierea meta pentru a reflecta analiza fără cookie-uri.

### 2. `/politica-confidentialitate` — `src/routes/politica-confidentialitate.tsx`
- Extinde **3.2. Date colectate automat** cu punctul despre analiza de trafic agregată și anonimă, fără cookie-uri.
- Adaugă paragraful despre **adresa IP** prelucrată tranzitoriu la nivel de infrastructură, în temeiul interesului legitim, nestocată ca dată de analiză.
- Restul secțiunilor (drepturi concrete, vârstă 16 ani) rămân ca acum, fiind deja actualizate.

### 3. `/termeni-si-conditii` — `src/routes/termeni-si-conditii.tsx`
- Adaugă **3.5. Despăgubire (clauză de garanție)** la secțiunea 3.
- În secțiunea 5, adaugă paragrafele **Responsabilitatea fiscală** și **Siguranța spațiului**.

## Detalii tehnice
Se folosesc componentele existente din `@/components/legal-page` (`LegalPage`, `H2`, `H3`, `P`, `UL`, `Strong`, `Note`, `Table`). Data „Ultima actualizare" rămâne 8 august 2026. Nu se modifică rute, meniuri sau footer.

## Verificare
- `bun run build` trece fără erori.
- Cele trei pagini se încarcă și afișează secțiunile noi.
