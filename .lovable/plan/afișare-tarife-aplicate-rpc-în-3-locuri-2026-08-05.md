# Afișare tarife aplicate (RPC) în 3 locuri

Scop: arătăm ce tarife s-au aplicat efectiv unui interval, folosind noul RPC `get_booking_rate_breakdown`. Doar afișare — totalul rămâne exact cum e calculat/stocat azi.

## Regula de afișare (identică peste tot)

- 1 tarif returnat: `20 RON/oră · general`
- 2+ tarife: titlu `Tarife aplicate:` urmat de listă `• zi — 90 RON/oră`, `• seara — 150 RON/oră`
- 0 rânduri sau eroare RPC: nu se afișează nimic (rămâne doar Total)
- Text simplu, se încadrează pe mobil (wrap, fără scroll orizontal)

## Unde apare

1. **Pagina sălii** (`src/routes/sali.$slug.tsx`) — în cardul de sumar din dreapta, imediat deasupra liniei Total. Se cere breakdown-ul pentru sala + data + intervalul selectat. Pentru selecții cu mai multe intervale/zile, se agregă tarifele distincte din toate intervalele și se afișează cu aceeași regulă.
2. **Checkout** (`src/routes/rezerva.$slug.tsx`) — înlocuiește complet textul actual „Tarife aplicate: general", care era calculat local din reguli (`getPriceForSlotDetailed` / `first_label`). Subtotal, voucher și Total rămân neschimbate. Pentru recurent se folosește intervalul săptămânal (prima sesiune).
3. **Pagina de confirmare** (`src/routes/confirmare.tsx`) — înlocuiește rândul actual „Preț/oră: 20 RON/oră · general" (bazat pe `pricing_rule_label`) cu varianta din RPC. Pe ecranul de succes pentru serii recurente (fără detalii) nu se afișează nimic.

## Detalii tehnice

- Fișier nou `src/lib/rate-breakdown.ts`:
  - tip `RateBreakdownRow = { label: string; price_per_hour: number }`
  - `fetchRateBreakdown(roomId, date, start, end)` — apel `supabase.rpc("get_booking_rate_breakdown", { p_room_id, p_date, p_start_time, p_end_time })` prin `@/integrations/supabase/external-client`; la eroare returnează `[]` (fără throw, fără toast).
  - `useRateBreakdown(intervals)` — hook care primește 0..n intervale `{roomId, date, start, end}`, le cere în paralel, deduplică pe `label+price_per_hour` și returnează lista finală. Fără intervale → listă goală.
- Componentă nouă `src/components/rate-breakdown.tsx` — randează adaptiv (1 rând simplu vs. listă), `null` când lista e goală. Reutilizată în toate cele 3 locuri, ca să nu existe două variante de afișare.
- Se șterge blocul IIFE cu `allLabels` din `rezerva.$slug.tsx` (liniile ~1415-1432) și rândul `Preț/oră` din `confirmare.tsx` (~388-401). `getPriceForSlotDetailed` rămâne folosit pentru calculul totalului — nu se atinge.
- Datele pentru RPC: `p_date` în format `YYYY-MM-DD`, orele ca `HH:MM` din intervalele deja existente în state.

## Verificare

Build, apoi confirm în preview: breakdown vizibil în toate cele 3 pagini, un singur tarif afișat simplu, mai multe tarife ca listă, iar valoarea Total identică cu cea de dinainte.
