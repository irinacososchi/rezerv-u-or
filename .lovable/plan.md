# Eliminare query mort `blocked_dates` din `src/routes/sali.$slug.tsx`

## Context
Tabelul `blocked_dates` nu există în baza de date. Query-ul către acesta returnează 404, iar rezultatul nu este folosit efectiv — blocările reale vin din înregistrările `bookings` cu `status='blocată'`. Eliminarea este doar curățare de cod mort.

## Modificări

1. **Înlătură query-ul `blocked_dates`** din `Promise.all` (în jurul liniei 264-296):
   - Șterge apelul `supabase.from("blocked_dates").select("blocked_date")...`.
   - Elimină `blockRes` din destructurarea `[photosRes, schedRes, priceRes, blockRes, bookRes]`.

2. **Elimină starea `blockedDates`** (în jurul liniei 197):
   - Șterge `const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());`.

3. **Elimină setarea stării** (în jurul liniei 312-318):
   - Șterge blocul `setBlockedDates(new Set(...))`.

4. **Elimină verificarea `blockedDates` din `isDayDisabled`** (în jurul liniei 357-366):
   - Șterge linia `if (blockedDates.has(iso)) return true;`.
   - Păstrează restul logicii (zile trecute, program săptămânal).

5. **Curățare variabile nefolosite**:
   - Verifică și elimină eventualele importuri sau variabile rămase nefolosite după pașii de mai sus (de exemplu `blockRes`).

## Verificare
- Rulează build-ul pentru a confirma că nu apar erori de tip/sintaxă.
- Confirmă în Network că request-ul `blocked_dates?select=...` nu mai este emis.

## Note
- NU se modifică query-ul `bookings` (blocările reale rămân intacte).
- NU se modifică logica de prețuri, fotografii sau program săptămânal.
