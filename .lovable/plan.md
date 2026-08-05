# Audit: surse de scroll orizontal pe mobil

Metodă: măsurare reală cu browser la 360px și 393px (scrollWidth vs viewport) pe paginile publice, plus scanare statică a claselor pe toate paginile. Paginile din panou nu au putut fi măsurate live (sesiunea de preview e delogată), deci acolo concluziile sunt din cod.

## Rezultatul măsurătorilor (pagini publice)

Toate curate la 360px și 393px — `scrollWidth === viewport`:
`/`, `/sali`, `/sali/{slug}`, `/rezerva/{slug}`, `/confirmare`, `/rezervari`, `/contact`, `/login`, `/signup`.

Singurul element care depășește viewportul pe `/sali/{slug}` este thumbnail-ul din galerie (`h-20 w-28 flex-shrink-0`, dreapta la 488px) — dar e **conținut** corect în stripul cu `overflow-x-auto` de la fixul anterior. Nu produce scroll de pagină.

Concluzie: în starea curentă nu mai există scroll orizontal la nivel de pagină pe zona publică. Ce urmează sunt riscuri reale, dar latente sau în panou.

## Prioritate 1 — probabil produc scroll pe mobil (panou, nemăsurabil delogat)

1. `src/routes/panou.vouchere.tsx:435-436` — `<div className="overflow-x-auto"><Table>` cu 7 coloane (Cod, Reducere, Aplicabil la, Utilizări, Valabil până la, Status, Acțiuni). Tabelul nu are variantă mobilă de tip card (spre deosebire de dashboard și ClientList, care ascund tabelul sub `md:`/`lg:`). Chiar dacă `overflow-x-auto` există, `shadcn/ui` `Table` are deja un wrapper propriu `overflow-auto`, iar celulele fără `whitespace-nowrap` produc rânduri foarte înalte și strâmte; pe 360px e cel mai prost UX din panou. Risc de scroll de pagină doar dacă un părinte pierde constrângerea, dar risc UI cert.

2. `src/routes/panou.sali.$id.calendar.tsx:902-903` și `src/routes/panou.orarul-meu.tsx:407-408` — vizualizarea „săptămână": `<div class="overflow-x-auto"><div class="min-w-[760px]">`. 760px fix la 360-393px viewport. Se bazează exclusiv pe faptul că fiecare părinte e `block`; orice părinte `flex`/`grid` introdus mai târziu (implicit `min-width:auto`) reproduce exact bug-ul galeriei. Plasa de siguranță e `main` din `owner-layout.tsx:399` (`min-w-0 overflow-x-hidden`) — care ar tăia conținutul, nu l-ar face scrollabil.

3. `src/components/owner/room-form-page.tsx:638-645` — grupul de input pentru URL: prefix `rzrv.ro/sali/` cu `whitespace-nowrap` + input, într-un `flex` unde inputul nu are `min-w-0`. Cu un slug lung, inputul nu se poate contracta sub lățimea sa intrinsecă și împinge containerul.

4. Șiruri lungi nefragmentate — email/referință afișate fără `break-words`:
   - `src/components/clients/ClientList.tsx:200` (`TableCell` email) și `:223` (cardul mobil `Email: {c.email}`)
   - `src/routes/panou.cereri.tsx:549` și `:621` (`font-mono #{reference}`)
   Un email de tip `prenume.nume.foarte.lung@subdomeniu.exemplu.ro` întinde cardul pe mobil.

## Prioritate 2 — risc mediu / de obicei conținut

5. `src/routes/panou.sali.$id.calendar.tsx:843` — coloana de ore `w-16 shrink-0` + 7 coloane de zi, în vizualizarea zi/săptămână. Depinde de containerul scrollabil de la punctul 2.

6. `src/components/notification-bell.tsx:89` — `PopoverContent className="w-[22rem]"` = 352px. Încape la 360/393px doar pentru că Radix corectează coliziunea; fără `max-w-[calc(100vw-2rem)]` e la limită pe ecrane de 320px.

7. `src/routes/panou.sali.$id.calendar.tsx:217` — tooltip `min-w-[180px]`: sigur azi, dar tooltipurile de rezervare cu nume lung de sală + notă pot depăși dacă se adaugă `whitespace-nowrap`.

8. `src/routes/panou.cereri.tsx:424-472` — filtrele: `grid sm:grid-cols-2` cu două `input[type=date]` alăturate. Are deja `min-w-0` pe container și pe ambele inputuri, deci e corect; îl notez doar ca pattern de urmărit, pentru că inputurile date native au lățime intrinsecă mare.

9. `src/routes/panou.sali.$id.calendar.tsx:1050` și `panou.orarul-meu.tsx:512` — marginile negative `-ml-px -mt-px` din grila lunară. 1px, inofensiv, dar e o categorie de risc.

10. `src/routes/rezerva.$slug.tsx:1307` — `grid lg:grid-cols-[1fr_1.4fr]` fără `min-w-0` pe coloane. Pe mobil e o singură coloană, deci nu se manifestă acum; devine problemă dacă se introduce conținut wide (grilă de ore, tabel) în coloană.

11. `src/routes/sali.index.tsx:131` — `grid lg:grid-cols-[280px_1fr]` fără `min-w-0`. Coloana de 280px se aplică doar de la `lg`, deci mobilul e sigur.

## Prioritate 3 — verificat, fără problemă

- Imagini: nu există `<img>` fără constrângere de lățime pe rutele publice; toate folosesc `w-full object-cover` sau dimensiuni fixe mici.
- Nu există nicăieri în `src` `w-screen`, `100vw` pe lățime, sau margini negative mari.
- `PageShell` din `sali.$slug.tsx:1585` are deja `overflow-x-hidden`; `owner-layout.tsx:399` la fel pe `main`.
- `DialogContent` (`ui/dialog.tsx:41`) e `w-full max-w-lg` — corect pe mobil; dialogurile din calendar și `BookingDetailsRenter` nu suprascriu lățimea cu valori fixe.
- `SheetContent` din meniul burger: `w-[280px] max-w-[85vw]` — corect.

## Ce nu s-a putut verifica

Paginile `/panou/*` (dashboard, sali, calendar, cereri, vouchere, clienti, cont, orarul-meu) nu au putut fi măsurate în browser pentru că sesiunea de preview e delogată. Dacă te autentifici în preview, pot relua măsurătoarea live pe toate și pot confirma care dintre punctele 1-5 produc efectiv scroll de pagină, înainte de a schimba ceva.

## Plan de remediere propus (când aprobi trecerea la implementare)

1. Vouchere: variantă mobilă tip card sub `md:` (ca la `ClientList`), tabelul rămâne doar pe desktop.
2. Calendar săptămână (owner + orarul meu): adăugare `min-w-0` pe wrapperul de secțiune al containerului `overflow-x-auto`, ca stripul să rămână scrollabil intern indiferent de context.
3. `room-form-page`: `min-w-0` pe input și pe wrapperul flex; prefixul primește `shrink-0`.
4. `break-words` pe email și referință în `ClientList` și `panou.cereri`.
5. `max-w-[calc(100vw-2rem)]` pe `PopoverContent` din `notification-bell`.
6. `min-w-0` preventiv pe coloanele grid din `rezerva.$slug.tsx` și `sali.index.tsx`.
