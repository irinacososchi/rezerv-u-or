# Actualizare Politică de Confidențialitate

## Obiectiv
Înlocuiește conținutul paginii `/politica-confidentialitate` cu varianta finală furnizată de utilizator, care adaugă detalii despre exercitarea drepturilor GDPR, confirmarea vârstei minime la crearea contului și data actualizată.

## Modificări propuse
1. **Actualizare conținut** în `src/routes/politica-confidentialitate.tsx`:
   - Adaugă secțiunea „Cum vă exercitați drepturile în mod concret:" la punctul 7, cu instrucțiuni pentru ștergerea contului și acces/rectificare/restricționare.
   - Actualizează punctul 9 „Datele minorilor" pentru a include confirmarea vârstei de minim 16 ani la crearea contului.
   - Actualizează data din `updatedAt` la data curentă (8 august 2026).
   - Păstrează structura existentă (componente `LegalPage`, `H2`, `H3`, `P`, `UL`, `Strong`, `Note`, `Table`) și link-ul către Politica de Cookies.

2. **Fără alte schimbări** de rutare, design sau logică de business.

## Cum se verifică
- Build-ul trece fără erori de sintaxă.
- Pagina `/politica-confidentialitate` se încarcă corect și afișează textul actualizat.
- Link-ul către `/politica-cookies` și adresa de mail `contact@rzrv.ro` rămân funcționale.
