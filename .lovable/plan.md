# Meniu burger în bara de sus (mobil)

Înlocuim bara de navigare fixă de jos din panou cu un meniu burger deschis din antetul de sus, pe mobil. Pe desktop nu se schimbă nimic — sidebar-ul rămâne identic.

## Ce se schimbă vizual

Antetul mobil al panoului devine: logo (stânga) — clopoțel notificări + buton burger (dreapta). Butonul de deconectare dispare din antet și se mută în meniu.

La apăsarea burgerului se deschide un panou lateral (Sheet) care alunecă din dreapta, cu:

- Numele utilizatorului sus
- Acasă
- Toate elementele de navigare potrivite rolului, grupate ca în sidebar-ul de desktop:
  - Proprietar: Dashboard, Sălile mele, Calendar, Cereri, Vouchere, Clienții mei
  - Chiriaș: Orarul meu, Clienții mei
- Separator, apoi: Cont și Deconectare

Elementul activ este evidențiat la fel ca în sidebar. Meniul se închide automat la navigare.

Beneficiu direct: pe mobil devin accesibile Vouchere, Clienții mei și Cont, care acum sunt tăiate din cauza limitei de 5 poziții din bara de jos.

## Ce dispare

Bara fixă de navigare de jos de pe mobil. Odată eliminată, se scoate și spațiul rezervat pentru ea, iar bara de acțiuni fixă din formularul de sală nu mai riscă suprapunerea.

## Detalii tehnice

Fișier principal: `src/components/owner-layout.tsx`.

- Se folosește `Sheet` / `SheetContent` (side="right") din `@/components/ui/sheet`, cu `SheetTitle` pentru accesibilitate.
- Se adaugă starea `mobileMenuOpen`; iconițe `Menu` din lucide-react.
- Se elimină blocul `<nav className="md:hidden fixed bottom-0 ...">` (liniile ~333-355) și lista `mobileItems` cu logica de limitare la 5 elemente; meniul folosește direct `flatItems` / grupurile `OWNER_ITEMS` + `RENTER_ITEMS`.
- Se scoate `pb-20` de pe `<main>` (rămâne `md:pb-0` inutil, deci se curăță clasa).
- Antetul mobil (liniile ~310-324): butonul `LogOut` se înlocuiește cu `SheetTrigger` pe buton burger; `handleLogout` se refolosește în interiorul meniului.
- Fiecare intrare din meniu apelează `setMobileMenuOpen(false)` la click; se păstrează `<a href>` pentru navigare completă, ca în implementarea actuală.
- Se reutilizează `isActive()` existent pentru evidențierea rutei curente.
- `src/components/owner/room-form-page.tsx` linia 1167: bara fixă de jos poate rămâne neschimbată; se verifică doar că nu mai există decalaj vizual după eliminarea navigării de jos.
