# Zile blocate care nu se înnegresc — diagnostic finalizat parțial + pași următori

## Ce am confirmat până acum (măsurat, nu presupus)

- Interogarea calendarului nu filtrează după status: exclude doar `refuzată`, `anulată`, `expirată`. Cu cheia publică (utilizator nelogat) rândurile `blocată` 09:00–23:00 pe 17 și 24 august CHIAR sunt returnate pentru sala `nunu`.
- Logica de „ocupat" (atât `fullyBookedDays`, cât și grila de sloturi) nu verifică nicăieri statusul; folosește doar suprapunerea de intervale. Blocul 09:00–23:00 acoperă toate cele 24 de sloturi ale programului 09:00–21:00.
- Randare reală, nelogat, pe **https://rzrv.ro/sali/nunu**: zilele 15, 17, 22, 24 august sunt toate `disabled`, gri, cu tooltip „Complet rezervat".

Deci ipoteza A (filtru de status în cod) și ipoteza B (end_time peste ora de închidere) sunt ambele infirmate pentru vizitatorul nelogat.

## Ipoteza rămasă

Tu vezi zilele clickabile fiind **autentificat**. Diferența dintre sesiunea ta și testul meu nelogat este singurul factor rămas: regulile de acces la tabelul de rezervări pot returna alt set de rânduri pentru un utilizator logat decât pentru un vizitator anonim. Dacă regula pentru utilizatorii autentificați arată doar rezervările proprii (plus cele ale sălilor pe care le deții), rândurile `blocată` ale altui proprietar dispar din răspuns pentru tine — deci ziua nu mai are ce să înnegrească. Aceasta este o ipoteză, nu un fapt verificat, pentru că nu pot rula o interogare cu sesiunea ta.

## Pași propuși

1. **Confirmare** (fără modificări de cod): reproduc pagina în browser cu sesiune autentificată și compar exact rândurile returnate pentru 2026-08-17 față de cazul nelogat. Dacă rândul `blocată` lipsește când ești logat, ipoteza e confirmată.
2. **Corecție, în funcție de rezultat:**
   - Dacă lipsesc rândurile → ajustăm regulile de acces astfel încât disponibilitatea (dată, oră start, oră final, status) unei săli active să fie vizibilă identic pentru vizitatori și utilizatori logați, fără a expune date personale ale rezervării.
   - Dacă rândurile există și tot nu se înnegresc → problema e în randarea din pagina sălii pentru starea autentificată, și investighez acolo.
3. **Verificare finală**: reîncarc pagina logat și confirm că 17 și 24 august sunt gri, neclickabile, cu tooltip „Complet rezervat", iar zilele parțial libere rămân selectabile.

## Ce îmi trebuie de la tine

Ca să rulez pasul 1 am nevoie fie de un cont de test (email + parolă) pentru site, fie confirmă că pot folosi contul cu care ești logat acum. Alternativ, spune-mi cu ce cont ai văzut zilele clickabile (chiriaș obișnuit, sau proprietarul altei săli).
