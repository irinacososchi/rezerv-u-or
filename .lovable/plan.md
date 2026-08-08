# Pagini legale + linkuri în footer

Cele trei documente sunt deja încărcate (Termeni și Condiții, Politica de Confidențialitate, Politica de Cookies), așa că le folosesc direct — nu e nevoie să lipești conținutul din nou.

## Ce se construiește

Trei pagini publice noi, cu același antet și subsol ca restul site-ului:

- `/termeni-si-conditii` — „Termeni și Condiții"
- `/politica-confidentialitate` — „Politica de Confidențialitate"
- `/politica-cookies` — „Politica de Cookies"

Fiecare pagină: coloană centrată `max-w-3xl mx-auto`, spațiere generoasă, titluri, paragrafe, liste și tabele stilizate cu tema existentă (fără dependențe noi). Data „Ultima actualizare" va fi setată la 8 august 2026 în locul marcajului `[DATA LANSĂRII]`.

## Footer

Footer-ul există deja (`src/components/site-footer.tsx`) și e folosit pe paginile publice. Îl extind:

- linkuri `<Link>` către cele trei pagini + Contact
- linia de identificare: „COSOSCHI GHEORGHE-ALEXANDRU PFA · CUI 48240601 · contact@rzrv.ro"
- păstrez nota de copyright, aranjate curat pe mobil și desktop

## Detalii tehnice

- Rute noi: `src/routes/termeni-si-conditii.tsx`, `src/routes/politica-confidentialitate.tsx`, `src/routes/politica-cookies.tsx`, fiecare cu `createFileRoute` și `head()` propriu (title + description + og).
- Conținutul markdown se transformă în JSX static la scriere (fără `react-markdown`), deci textul se editează direct în fișierul rutei respective.
- Componentă comună `src/components/legal-page.tsx` pentru layout (header, container, subsol) și clasele de tipografie, ca cele trei pagini să arate identic.
- Build la final pentru verificare.
