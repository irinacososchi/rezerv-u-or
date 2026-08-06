# Eliminare bloc duplicat de email recurent

## Context
În fix-ul anterior pentru emailul de refuz al seriei recurente, `bulkUpdateStatus` din `panou.cereri.tsx` și `panou.dashboard.tsx` ar fi trebuit să înlocuiască blocul vechi (doar aprobare) cu unul nou combinat (aprobare + refuz). Utilizatorul raportează că ambele blocuri există acum în paralel, ceea ce duce la trimiterea a DOUĂ emailuri de aprobare per serie.

## Obiectiv
Păstrează doar blocul combinat (aprobare + refuz) în ambele fișiere și elimină blocul vechi, exclusiv de aprobare, dacă încă există.

## Pași
1. **Verificare** — Re-citește funcția `bulkUpdateStatus` în `src/routes/panou.cereri.tsx` și `src/routes/panou.dashboard.tsx` pentru a confirma dacă există două blocuri consecutive de email recurent.
2. **Eliminare bloc duplicat** — Dacă blocul vechi (doar aprobare) este prezent, îl ștergem în ambele fișiere. Blocul nou combinat rămâne nemodificat.
3. **Verificare post-editare** — Asigurăm că în fiecare fișier există exact UN singur bloc de email recurent, cu ramurile pentru `confirmată` (recurring-approved) și `refuzată` (recurring-ended/refused).
4. **Build** — Rulează `bunx vite build` / `npm run build` pentru validare.
5. **Confirmare comportament** — După build, aprobarea unei serii recurente trimite UN email, iar refuzul trimite UN email, atât din Cereri cât și din Dashboard.

## Fișiere vizate
- `src/routes/panou.cereri.tsx`
- `src/routes/panou.dashboard.tsx`

## Nu se modifică
- Blocul combinat nou (ramurile `confirmată` și `refuzată`).
- Logica de actualizare a statusului înainte de blocul de email.
- Alte componente sau rute.
