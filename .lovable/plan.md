# Investigație „Aprobă tot” pe cererile recurente

## Constatări (fără modificări de logică)

**1. Este butonul într-un `<form>`? Ce `type` are?**
Nu există niciun `<form>` sau `onSubmit` în `src/routes/panou.cereri.tsx`, `src/routes/panou.tsx` sau `src/components/owner-layout.tsx` — deci butonul nu are un formular părinte în acest arbore.
Însă **niciun buton din `RecurringGroupCard` nu are `type`**, deci toate sunt implicit `type="submit"`. Asta e o bombă cu ceas: dacă vreun wrapper (dialog, layout, viitor formular de filtre) introduce un `<form>`, click-ul devine submit + reload. Recomand `type="button"` pe toate.

**2. JSX-ul butonului și onClick (fără `preventDefault`)**

```tsx
<button
  onClick={handleApproveAll}
  disabled={processing}
  className="inline-flex items-center gap-1 rounded-md bg-primary ..."
>
  <Check className="h-3.5 w-3.5" />
  Aprobă seria
</button>
```

```tsx
async function handleApproveAll() {
  setProcessing(true);
  try {
    await onApproveAll(groupId);
  } finally {
    setProcessing(false);
  }
}
```

Handler-ul nu primește evenimentul și **nu apelează `preventDefault()`**.

**4. Ce ar putea produce reload complet?**
- `type` lipsă pe butoane (submit implicit) — singura cauză structurală plauzibilă găsită.
- Nu există `<a href>` și niciun `window.location` pe acest traseu.
- Alternativ, „reload-ul" perceput poate fi de fapt `refetch()` care re-randează lista, sau o eroare runtime care resetează ruta. Logurile de la punctul 3 vor decide între cele două.

Nu am putut confirma o cauză definitivă din citirea codului; de aceea pasul următor este instrumentarea.

## Modificări propuse (doar instrumentare)

1. `src/components/owner/recurring-group-card.tsx`
   - `handleApproveAll` primește `e?: React.MouseEvent`, apelează `e?.preventDefault()` și loghează `console.log("APROBA TOT CLICKED", groupId)` ca primă instrucțiune.
   - Adaug `type="button"` pe toate butoanele din card (aprobă/refuză serie, gestionează, aprobă/refuză selecția, anulează) — protecție împotriva submit-ului implicit.
2. `src/routes/panou.cereri.tsx`
   - `console.log("BULK UPDATE running", filter, newStatus)` ca primă linie în `bulkUpdateStatus`, plus logarea erorii returnate de update.

Logurile rămân active pentru citire în consolă. Build + typecheck după.
