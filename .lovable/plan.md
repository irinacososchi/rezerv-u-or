Adăugare două checkbox-uri obligatorii în formularul de înregistrare (`/signup`).

## Ce se modifică

- Doar `src/routes/signup.tsx`; nu se ating `login.tsx`, `rezerva.$slug.tsx` sau alte fluxuri.

## Schimbări funcționale

1. **Checkbox-uri noi** (ambele debifate implicit), plasate una sub alta, deasupra butonului de submit:
   - **Consimțământ legal**: "Sunt de acord cu Termenii și Condițiile și Politica de Confidențialitate"
     - Link `<Link>`/`a` către `/termeni-si-conditii` și `/politica-confidentialitate` cu `target="_blank" rel="noopener noreferrer"`.
   - **Vârstă**: "Confirm că am cel puțin 16 ani".

2. **Gatări**:
   - Butonul "Creează cont" rămâne `disabled` până când ambele checkbox-uri sunt bifate (pe lângă condițiile existente: `loading`, `emailExists`, `checkingEmail`).
   - Dacă utilizatorul apasă submit fără ambele bifate (ex. prin Enter când butonul e disabled), handlerul afișează un hint mic sub checkbox-uri.

3. **Stare**:
   - Adaugă două state-uri booleene: `agreedToLegal` și `isOver16`.
   - Nu se salvează coloane noi în DB; validarea e strict UI-side.

## Detalii tehnice

- Se importă `Checkbox` din `@/components/ui/checkbox`.
- Se importă `Link` (deja existent) pentru linkurile interne, dar linkurile legale folosesc `<a>` pentru `target="_blank"` (păstrează focusul în tab-ul signup).
- Layout: fiecare checkbox într-un `<div className="flex items-start gap-3">` cu label alăturat, pe două rânduri, text mic (`text-sm`).
- Hint de validare: un `<p>` roșu/discreet care apare când `showConsentHint` e true.

## Verificare finală

- Build local.
- Manual: accesezi `/signup`, butonul e disabled, bifezi doar unul → în continuare disabled, bifezi ambele → enabled, click pe linkuri legale → se deschid în tab nou pe rutele corecte.
