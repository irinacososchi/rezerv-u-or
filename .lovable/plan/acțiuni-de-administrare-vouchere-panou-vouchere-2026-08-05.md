# Acțiuni de administrare vouchere (panou/vouchere)

## Ce se adaugă

Pe fiecare rând din tabelul „Voucherele tale":

1. **Toggle activ/inactiv** — există deja (`Dezactivează` / `Activează`). Rămâne, dar după update se reîncarcă lista din baza de date în loc de update local, ca să reflecte starea reală.
2. **Buton de ștergere** (iconiță coș de gunoi), lângă toggle:
   - voucher **nefolosit** (`times_used = 0`): deschide o confirmare
     - Titlu: „Ștergi voucherul?"
     - Text: „Ești sigur că vrei să ștergi voucherul {cod}? Această acțiune nu poate fi anulată."
     - Butoane: „Șterge" (roșu) / „Anulează"
   - voucher **folosit** (`times_used > 0`): buton dezactivat, cu explicație la hover: „Voucherele folosite nu pot fi șterse. Le poți dezactiva."
3. **Erori** — dacă ștergerea eșuează (voucherul a fost folosit între timp), se afișează un mesaj prietenos: „Voucherul nu poate fi șters (a fost folosit). Îl poți dezactiva." — niciodată eroarea brută din baza de date.

## Detalii tehnice

Un singur fișier: `src/routes/panou.vouchere.tsx`.

- Import: `AlertDialog*` din `@/components/ui/alert-dialog`, `Tooltip*` din `@/components/ui/tooltip`, `toast` din `sonner`, `Trash2` din `lucide-react`.
- State nou: `deleteTarget: Voucher | null` pentru dialogul de confirmare.
- `toggleVoucher`: `update({ is_active: !current })` apoi `refreshVouchers(userId)`; pe eroare, `toast.error`.
- `handleDelete`: `supabase.from("voucher_codes").delete().eq("id", id)`; la eroare → toast-ul de mai sus; la succes → `toast.success("Voucher șters.")` + `refreshVouchers`.
- Toate butoanele primesc `type="button"` și handlerele apelează `e.preventDefault()` (evită submit implicit / reload de pagină).
- Butonul dezactivat se învelește într-un `<span>` pentru ca tooltip-ul să funcționeze.

Nu se modifică: fluxul de creare voucher, backend/RLS, afișarea `times_used / max_uses`.
