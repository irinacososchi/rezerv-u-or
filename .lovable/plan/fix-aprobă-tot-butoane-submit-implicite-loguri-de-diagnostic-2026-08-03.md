# Fix „Aprobă tot" — butoane submit implicite + loguri de diagnostic

## Modificări

### `src/components/owner/recurring-group-card.tsx`
- `type="button"` pe toate elementele `<button>` din card: Aprobă seria, Refuză seria (trigger-ul de AlertDialog), Gestionează serie, Aprobă selecția, Refuză selecția, Anulează.
- `handleApproveAll`, `handleRefuseAll`, `handleApproveSelected`, `handleRefuseSelected` primesc `e?: React.MouseEvent` și apelează `e?.preventDefault()` ca primă linie.
- `console.log("APROBA TOT CLICKED", groupId)` la începutul `handleApproveAll`.

### `src/routes/panou.cereri.tsx`
- `console.log("BULK UPDATE running", filter, newStatus)` ca primă linie în `bulkUpdateStatus`.

Logica de aprobare rămâne neschimbată; nu se ating alte componente. Build + typecheck după.
