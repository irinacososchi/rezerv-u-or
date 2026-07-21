Am găsit butonul. În `src/routes/panou.dashboard.tsx`, cererile recurente din secțiunea „Cereri în așteptare” sunt randate cu componenta `RecurringGroupCard` (`src/components/owner/recurring-group-card.tsx`), iar butonul „Gestionează serie” vine din acea componentă. Butonul este folosit în continuare pe pagina `/panou/cereri`, deci îl ascundem doar pe Dashboard.

Plan:

1. Modific `src/components/owner/recurring-group-card.tsx`
   - Adaug prop opțional `showManageButton?: boolean` (default `true`).
   - Randez butonul „Gestionează serie” doar când `showManageButton !== false`.
   - Păstrez restul funcționalității (Aprobă seria / Refuză seria) neschimbate.

2. Modific `src/routes/panou.dashboard.tsx`
   - La apelul `<RecurringGroupCard ... />` din secțiunea pending, adaug `showManageButton={false}`.

3. Verific tipurile cu `bunx tsgo --noEmit` pentru a mă asigura că nu stric semnăturile existente.

Nu se modifică logica de aprobare/refuz, backend-ul, emailurile sau pagina `/panou/cereri`.