import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, H2, H3, P, UL, Strong, Note, Table } from "@/components/legal-page";

const TITLE = "Politica de Confidențialitate — RZRV";
const DESC =
  "Cum colectează, folosește și protejează RZRV datele cu caracter personal ale utilizatorilor, conform GDPR.";

export const Route = createFileRoute("/politica-confidentialitate")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: ConfidentialitatePage,
});

function ConfidentialitatePage() {
  return (
    <LegalPage title="Politica de Confidențialitate" updatedAt="8 august 2026">
      <H2>1. Cine suntem</H2>
      <P>
        Această Politică de Confidențialitate descrie modul în care sunt colectate, utilizate și
        protejate datele cu caracter personal ale utilizatorilor platformei <Strong>RZRV</Strong>{" "}
        (accesibilă la adresa rzrv.ro, denumită în continuare „Platforma").
      </P>
      <P>Operatorul datelor cu caracter personal este:</P>
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <p className="font-semibold text-foreground">
          COSOSCHI GHEORGHE-ALEXANDRU PERSOANĂ FIZICĂ AUTORIZATĂ
        </p>
        <p>CUI: 48240601</p>
        <p>Nr. Registrul Comerțului: F40/4019/2023</p>
        <p>Sediu: B-dul Bucureștii Noi nr. 136, et. Parter, ap. 5, Sector 1, București</p>
        <p>E-mail de contact: contact@rzrv.ro</p>
      </div>
      <P>(denumit în continuare „Operatorul", „noi" sau „RZRV")</P>
      <P>
        Ne angajăm să respectăm Regulamentul (UE) 2016/679 privind protecția persoanelor fizice în
        ceea ce privește prelucrarea datelor cu caracter personal (denumit „GDPR"), precum și
        legislația română aplicabilă în materie.
      </P>

      <H2>2. Ce este RZRV</H2>
      <P>RZRV este o platformă de intermediere care permite:</P>
      <UL>
        <li>
          <Strong>proprietarilor de spații</Strong> (săli de dans, fitness, evenimente) să își listeze
          spațiile spre închiriere;
        </li>
        <li>
          <Strong>chiriașilor</Strong> să caute și să rezerve aceste spații.
        </li>
      </UL>
      <P>
        RZRV facilitează legătura dintre proprietari și chiriași. Plata pentru închirierea spațiului
        se realizează <Strong>direct la sală</Strong>, între chiriaș și proprietar; RZRV nu procesează
        plăți prin Platformă.
      </P>

      <H2>3. Ce date colectăm</H2>
      <H3>3.1. Date furnizate direct de dumneavoastră</H3>
      <P>
        <Strong>La crearea unui cont</Strong> (proprietar sau chiriaș):
      </P>
      <UL>
        <li>nume și prenume;</li>
        <li>adresă de e-mail;</li>
        <li>număr de telefon;</li>
        <li>parolă (stocată criptat, nu avem acces la ea).</li>
      </UL>
      <P>
        <Strong>La efectuarea unei rezervări</Strong> (inclusiv ca vizitator neînregistrat):
      </P>
      <UL>
        <li>nume și prenume;</li>
        <li>adresă de e-mail;</li>
        <li>număr de telefon;</li>
        <li>detaliile rezervării (spațiul, data, intervalul orar).</li>
      </UL>
      <P>
        <Strong>La listarea unui spațiu</Strong> (proprietari):
      </P>
      <UL>
        <li>datele de contact asociate spațiului (nume, telefon, e-mail);</li>
        <li>descrierea, adresa și fotografiile spațiului;</li>
        <li>programul și tarifele.</li>
      </UL>
      <P>
        <Strong>La contactarea noastră</Strong> prin formularul de contact:
      </P>
      <UL>
        <li>nume, e-mail și conținutul mesajului.</li>
      </UL>

      <H3>3.2. Date colectate automat</H3>
      <UL>
        <li>
          date tehnice minime necesare funcționării (sesiune de autentificare, preferințe stocate
          local în browser — vezi{" "}
          <Link to="/politica-cookies" className="text-primary underline underline-offset-4">
            Politica de Cookies
          </Link>
          );
        </li>
        <li>
          date de analiză a traficului, în formă <Strong>agregată și anonimă</Strong>, printr-un
          sistem <Strong>fără cookie-uri</Strong>: număr de vizitatori, pagini vizitate, sursa
          vizitei, tipul de dispozitiv și țara (estimată din fusul orar al browserului). Aceste date
          nu creează profiluri și nu vă identifică individual.
        </li>
      </UL>
      <P>
        Ca la orice serviciu web, adresa IP este prezentă tranzitoriu în cererile HTTP la nivelul
        infrastructurii de găzduire, fiind prelucrată în temeiul interesului legitim de a asigura
        funcționarea și securitatea Platformei; nu o stocăm ca dată de analiză.
      </P>
      <P>
        Nu colectăm date cu caracter personal sensibile (origine etnică, convingeri, date de sănătate
        etc.) și nu realizăm profilare sau decizii automate cu efecte juridice asupra dumneavoastră.
      </P>

      <H2>4. De ce prelucrăm datele (scopuri și temeiuri legale)</H2>
      <Table
        headers={["Scop", "Temei legal (GDPR)"]}
        rows={[
          ["Crearea și administrarea contului", "Executarea contractului (art. 6(1)(b))"],
          ["Efectuarea și gestionarea rezervărilor", "Executarea contractului (art. 6(1)(b))"],
          [
            "Transmiterea e-mailurilor tranzacționale (confirmări, notificări de rezervare, modificări de status)",
            "Executarea contractului (art. 6(1)(b))",
          ],
          [
            "Facilitarea contactului între chiriaș și proprietar pentru o rezervare",
            "Executarea contractului / interes legitim (art. 6(1)(b)/(f))",
          ],
          [
            "Răspuns la solicitările transmise prin formularul de contact",
            "Interes legitim (art. 6(1)(f))",
          ],
          [
            "Respectarea obligațiilor legale (ex. contabile, fiscale, dacă este cazul)",
            "Obligație legală (art. 6(1)(c))",
          ],
        ]}
      />

      <H2>5. Cine are acces la datele dumneavoastră</H2>
      <P>
        <Strong>Între utilizatorii Platformei:</Strong>
      </P>
      <UL>
        <li>
          Atunci când efectuați o rezervare la un spațiu, <Strong>proprietarul acelui spațiu</Strong>{" "}
          primește datele necesare onorării rezervării: numele, adresa de e-mail, numărul de telefon
          și detaliile rezervării. Acest lucru este necesar pentru ca proprietarul să vă poată contacta
          și să gestioneze rezervarea.
        </li>
        <li>
          Atunci când un proprietar creează o rezervare în numele unui client, datele clientului sunt
          utilizate exclusiv pentru acea rezervare.
        </li>
      </UL>
      <P>
        <Strong>Furnizori de servicii (persoane împuternicite):</Strong> folosim furnizori terți care
        prelucrează date în numele nostru, exclusiv pentru funcționarea Platformei:
      </P>
      <UL>
        <li>
          <Strong>Supabase</Strong> — găzduirea bazei de date și autentificare;
        </li>
        <li>
          <Strong>Resend</Strong> — trimiterea e-mailurilor tranzacționale;
        </li>
        <li>
          <Strong>Cloudflare</Strong> — servicii de rețea, securitate și livrare conținut;
        </li>
        <li>
          <Strong>Lovable</Strong> — infrastructura de găzduire a aplicației.
        </li>
      </UL>
      <P>
        Acești furnizori prelucrează datele conform propriilor politici și în baza unor angajamente de
        confidențialitate și securitate. Unii pot stoca date în afara României, inclusiv în afara
        Spațiului Economic European, cu garanții adecvate conform GDPR.
      </P>
      <P>
        <Strong>Nu vindem</Strong> datele dumneavoastră și nu le divulgăm terților în scopuri de
        marketing.
      </P>
      <P>Putem divulga date autorităților publice atunci când legea ne obligă.</P>

      <H2>6. Cât timp păstrăm datele</H2>
      <UL>
        <li>
          Datele contului: pe durata existenței contului. La ștergerea contului, datele asociate sunt
          eliminate, cu excepția celor pe care trebuie să le păstrăm din obligații legale.
        </li>
        <li>
          Datele rezervărilor: pe durata necesară gestionării acestora și, ulterior, pe perioada
          impusă de eventuale obligații legale.
        </li>
        <li>Mesajele de contact: pe durata necesară soluționării solicitării.</li>
      </UL>

      <H2>7. Drepturile dumneavoastră</H2>
      <P>În conformitate cu GDPR, aveți următoarele drepturi:</P>
      <UL>
        <li>
          <Strong>dreptul de acces</Strong> la datele dumneavoastră;
        </li>
        <li>
          <Strong>dreptul la rectificare</Strong> a datelor inexacte;
        </li>
        <li>
          <Strong>dreptul la ștergere</Strong> („dreptul de a fi uitat");
        </li>
        <li>
          <Strong>dreptul la restricționarea</Strong> prelucrării;
        </li>
        <li>
          <Strong>dreptul la portabilitatea</Strong> datelor;
        </li>
        <li>
          <Strong>dreptul de opoziție</Strong> la prelucrare;
        </li>
        <li>
          <Strong>dreptul de a nu face obiectul</Strong> unei decizii automate.
        </li>
      </UL>
      <P>
        <Strong>Cum vă exercitați drepturile în mod concret:</Strong>
      </P>
      <UL>
        <li>
          <Strong>Ștergerea contului și a datelor:</Strong> ne puteți transmite o cerere la{" "}
          <a href="mailto:contact@rzrv.ro" className="text-primary underline underline-offset-4">
            contact@rzrv.ro
          </a>
          , iar noi vom șterge contul și datele asociate în termenul legal (cu excepția datelor pe
          care trebuie să le păstrăm din obligații legale).
        </li>
        <li>
          <Strong>Accesul, rectificarea sau restricționarea</Strong> datelor: prin solicitare la aceeași
          adresă de e-mail.
        </li>
      </UL>
      <P>
        Pentru exercitarea acestor drepturi, ne puteți contacta la{" "}
        <a href="mailto:contact@rzrv.ro" className="text-primary underline underline-offset-4">
          contact@rzrv.ro
        </a>
        . Vom răspunde în termenul prevăzut de lege (de regulă 30 de zile).
      </P>
      <P>
        De asemenea, aveți dreptul de a depune o plângere la{" "}
        <Strong>
          Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP)
        </Strong>
        ,{" "}
        <a
          href="https://www.dataprotection.ro"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-4"
        >
          www.dataprotection.ro
        </a>
        .
      </P>

      <H2>8. Securitatea datelor</H2>
      <P>
        Aplicăm măsuri tehnice și organizatorice pentru a proteja datele împotriva accesului
        neautorizat, pierderii sau divulgării. Accesul la date este restricționat la nivel de bază de
        date, astfel încât fiecare utilizator poate accesa doar datele la care are dreptul. Parolele
        sunt stocate criptat.
      </P>
      <P>
        Cu toate acestea, niciun sistem nu este complet sigur; nu putem garanta securitatea absolută a
        datelor transmise online.
      </P>

      <H2>9. Datele minorilor</H2>
      <P>
        Platforma nu se adresează persoanelor sub 16 ani. La crearea contului, utilizatorul confirmă
        că are cel puțin 16 ani. Nu colectăm cu bună știință date de la persoane sub această vârstă.
        Dacă aflăm că am colectat astfel de date fără consimțământul reprezentantului legal, le vom
        șterge fără întârziere.
      </P>

      <H2>10. Modificări ale acestei politici</H2>
      <P>
        Putem actualiza această Politică de Confidențialitate. Versiunea actualizată va fi publicată pe
        această pagină, cu data ultimei actualizări. Vă recomandăm să o consultați periodic.
      </P>

      <H2>11. Contact</H2>
      <P>
        Pentru orice întrebare legată de această politică sau de prelucrarea datelor dumneavoastră:{" "}
        <Strong>E-mail:</Strong>{" "}
        <a href="mailto:contact@rzrv.ro" className="text-primary underline underline-offset-4">
          contact@rzrv.ro
        </a>
      </P>

      <Note>
        Acest document constituie un draft inițial și ar trebui revizuit de un consultant juridic
        înainte de utilizarea în producție.
      </Note>
    </LegalPage>
  );
}
