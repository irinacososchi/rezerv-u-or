# Elimină restricția de format pentru linkul tur virtual

## Obiectiv
Permite orice link în câmpul `virtual_tour_url` (tur virtual 360°), eliminând orice restricție de format Google Maps și actualizând textele pentru a reflecta flexibilitatea.

## Stare actuală
- `src/components/owner/room-form-page.tsx`: câmpul `virtual_tour_url` este input de tip `text` fără `pattern` sau regex în `handleSave`.
- Label-ul și instrucțiunile de ajutor impresionează că doar linkurile Google Maps sunt acceptate.
- `src/routes/sali.$slug.tsx`: afișează linkul ca atare, fără validare.

## Modificări propuse

1. **Elimină orice restricție de format Google Maps** (frontend-only)
   - Verifică din nou `src/components/owner/room-form-page.tsx` în jurul liniilor 835-856 pentru `type="url"`, `pattern`, sau regex.
   - Dacă există, elimină-le.

2. **Actualizează label și instrucțiuni pentru a accepta orice link**
   - Label: `Link Google Maps` → `Link tur virtual 360°` (sau `Link tur virtual`).
   - Placeholder: păstrează un exemplu generic (`https://...`) sau unul cu Google Maps, dar fără a impune formatul.
   - Textul din `<details>`: reformulează pentru a nu limita la Google Maps. Ex:
     - „Adaugă un link către un tur virtual (Google Maps, Matterport, YouTube, etc.).”
     - Instrucțiunile „Cum obțin linkul?” pot rămâne ca exemplu pentru Google Maps, dar cu o notă că sunt acceptate și alte platforme.

3. **Pastrează comportamentul funcțional**
   - `handleSave` salvează `form.virtual_tour_url.trim() || null` — fără schimbări.
   - Public room page (`sali.$slug.tsx`) continuă să randeze linkul ca atare.

## Nu se modifică
- Schema bazei de date (conform memoriei proiectului, schema e pre-existentă).
- RLS sau backend.
- `google_maps_url` (câmp separat, rămâne neschimbat).

## Verificare
- Build dev să confirme că nu apar erori.
- În formularul de editare sală, câmpul de tur virtual acceptă orice link fără mesaj de eroare.
