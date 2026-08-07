# Anulare/suspendare serie recurentă de către proprietar — de ce 10-11 emailuri

## Ce am verificat efectiv

- `src/routes/panou.sali.$id.calendar.tsx`, `performBulkCancel()` (liniile ~1441-1479): singurele apeluri sunt RPC-urile
  `cancel_booking` (scope „this”, prin `cancelSingleBooking`), `cancel_booking_and_future` (scope „future”),
  `suspend_recurrence_until` (scope „suspend”) — toate cu `p_owner_override: true`. După succes se face doar
  `toast` + `onChanged()` + `onClose()`. **Nu există niciun `supabase.functions.invoke("send-booking-email", ...)`**
  pe această cale (`rg` pe fișier găsește un singur invoke, la linia 2618, pentru `recurring-approved` din rezervarea manuală).
- Același lucru în dialogul chiriașului `src/components/renter/BookingDetailsRenter.tsx`: doar RPC-uri, zero email.
- Singurul loc din tot `src/` care trimite `recurring-ended` este `src/routes/panou.cereri.tsx:358`
  (`reason: "refused"`, la refuzul unei serii).

## Ce NU pot verifica din acest mediu

Funcțiile `send-booking-email` și `send-owner-notification` și webhook-urile pe tabelul `bookings` trăiesc în
proiectul de backend extern (`src/integrations/supabase/external-client.ts`); în repo există doar
`supabase/functions/send-contact-email`. Deci comportamentul lor exact (filtrul pe `recurrence_id`, ramura UPDATE,
textul șablonului) este **deducție din simptom, nu verificat**. Primul pas al implementării va fi confirmarea lui.

## Diagnostic (cauză probabilă, consistentă cu simptomele)

1. **De ce 10-11 emailuri:** frontend-ul nu trimite niciun email pe această cale, deci tot ce ajunge în inbox vine
   de la webhook-uri de bază de date care se declanșează **per rând**. RPC-urile de anulare/suspendare pun
   `status = "anulată"` pe 10-11 sesiuni → 10-11 evenimente UPDATE → 10-11 emailuri.
2. **De ce ajung la proprietar și nu la chiriaș:** emailul este produs de notificarea „de proprietar”
   (`send-owner-notification` / ramura de owner din `send-booking-email`), care e concepută pentru cazul
   „chiriașul a anulat, anunță proprietarul”. Ea nu are de unde ști că actorul e chiar proprietarul.
3. **De ce mesajul spune că a anulat chiriașul:** același șablon — este singurul scenariu de anulare pe care îl
   cunoaște webhook-ul. Nu există un canal „owner cancelled series” apelat de nicăieri.
4. **Filtrul pe recurență:** la INSERT rândurile recurente sunt sărite (de asta seriile noi primesc email doar prin
   apelul explicit `recurring-created`). Spam-ul de față arată că acest skip **nu se aplică și pe UPDATE** —
   de confirmat la implementare.

## Unde trebuie pus apelul corect

În `performBulkCancel()`, imediat după ce RPC-ul reușește (`ok === true`), un singur apel fire-and-forget:

```ts
void supabase.functions.invoke("send-booking-email", {
  body: {
    type: "recurring-ended",
    recurrenceId: recurrenceInfo.id,
    reason: cancelScope === "suspend" ? "suspended"
          : cancelScope === "future"  ? "cancelled_future"
          : "cancelled",
    ...(cancelScope === "suspend" ? { date: cancelUntilDate } : {}),
  },
}).catch(console.warn);
```

Pentru scope `"this"` (o singură sesiune dintr-o serie) rămâne de decis dacă vrem email de „serie anulată” sau
niciun email de serie — vezi întrebarea de mai jos.

## Pași de implementare propuși (când aprobi)

1. **Backend (obligatoriu, altfel spam-ul rămâne):** în webhook-ul de UPDATE pe `bookings`, se sare peste rândurile
   cu `recurrence_id IS NOT NULL` la tranziția către `"anulată"` — atât pentru emailul către chiriaș, cât și pentru
   `send-owner-notification`. Asta oprește cele 10-11 emailuri și emailul greșit către proprietar.
2. **Frontend:** apelul unic `recurring-ended` din `performBulkCancel`, cu `reason` mapat pe scope, exact ca mai sus.
3. **Simetrie chiriaș:** aceeași logică în `BookingDetailsRenter.executeRecurringChoice()`, cu `reason` de tip
   „anulat de chiriaș”, ca proprietarul să fie anunțat o singură dată pe serie (altfel, după pasul 1, anularea de
   către chiriaș nu mai notifică pe nimeni).
4. **Șablon:** `recurring-ended` trebuie să suporte `reason` = `cancelled` / `cancelled_future` / `suspended`
   (cu data reluării) și să trimită **doar** chiriașului când actorul e proprietarul.
5. **Verificare:** anulare „viitoare” pe o serie de 10+ sesiuni → exact 1 email la chiriaș, 0 la proprietar;
   suspendare → 1 email cu data reluării; rezervările simple neschimbate.

## De clarificat

- La scope „doar această sesiune” dintr-o serie: vrem un email de tip „o sesiune anulată” către chiriaș, sau niciun email?
