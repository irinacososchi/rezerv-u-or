import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, H2, P, UL, Strong, Note } from "@/components/legal-page";

const TITLE = "Termeni și Condiții — RZRV";
const DESC =
  "Termenii și condițiile de utilizare a platformei RZRV: rolul de intermediar, rezervări, obligațiile proprietarilor și chiriașilor.";

export const Route = createFileRoute("/termeni-si-conditii")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: TermeniPage,
});

function TermeniPage() {
  return (
    <LegalPage title="Termeni și Condiții" updatedAt="8 august 2026">
      <H2>1. Introducere</H2>
      <P>
        Acești Termeni și Condiții („Termenii") reglementează utilizarea platformei{" "}
        <Strong>RZRV</Strong>, accesibilă la adresa rzrv.ro („Platforma"), operată de:
      </P>
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <p className="font-semibold text-foreground">
          COSOSCHI GHEORGHE-ALEXANDRU PERSOANĂ FIZICĂ AUTORIZATĂ
        </p>
        <p>CUI: 48240601</p>
        <p>Nr. Registrul Comerțului: F40/4019/2023</p>
        <p>Sediu: B-dul Bucureștii Noi nr. 136, et. Parter, ap. 5, Sector 1, București</p>
        <p>E-mail: contact@rzrv.ro</p>
      </div>
      <P>(denumit în continuare „RZRV", „noi" sau „Operatorul")</P>
      <P>
        Prin accesarea și utilizarea Platformei, sunteți de acord cu acești Termeni. Dacă nu sunteți
        de acord, vă rugăm să nu utilizați Platforma.
      </P>

      <H2>2. Ce este RZRV</H2>
      <P>
        RZRV este o <Strong>platformă de intermediere</Strong> care facilitează legătura dintre:
      </P>
      <UL>
        <li>
          <Strong>Proprietari</Strong> — persoane care oferă spre închiriere spații (săli de dans,
          fitness, evenimente);
        </li>
        <li>
          <Strong>Chiriași</Strong> — persoane care caută și rezervă aceste spații.
        </li>
      </UL>
      <P>
        RZRV pune la dispoziție instrumentele tehnice pentru listarea spațiilor și efectuarea
        rezervărilor.{" "}
        <Strong>
          RZRV nu este proprietarul spațiilor, nu le operează și nu este parte în contractul de
          închiriere
        </Strong>{" "}
        dintre proprietar și chiriaș.
      </P>

      <H2>3. Rolul RZRV. Limitarea răspunderii</H2>
      <P>
        3.1. RZRV acționează exclusiv ca <Strong>intermediar tehnic</Strong>. Contractul de
        închiriere a spațiului se încheie direct între proprietar și chiriaș.
      </P>
      <P>
        3.2. <Strong>Plata</Strong> pentru închirierea spațiului se realizează{" "}
        <Strong>direct la sală</Strong>, între chiriaș și proprietar. RZRV{" "}
        <Strong>nu procesează plăți</Strong> prin Platformă și nu percepe, în prezent, comisioane de
        la utilizatori pentru rezervări.
      </P>
      <P>3.3. RZRV nu garantează și nu răspunde pentru:</P>
      <UL>
        <li>
          exactitatea sau completitudinea informațiilor furnizate de proprietari (descrieri, tarife,
          disponibilitate, fotografii);
        </li>
        <li>calitatea, siguranța sau conformitatea spațiilor;</li>
        <li>comportamentul proprietarilor sau al chiriașilor;</li>
        <li>eventuale neînțelegeri, anulări sau litigii între proprietar și chiriaș.</li>
      </UL>
      <P>
        3.4. RZRV depune eforturi rezonabile pentru funcționarea corectă a Platformei, dar nu
        garantează funcționarea neîntreruptă sau lipsită de erori.
      </P>
      <P>
        3.5. <Strong>Despăgubire (clauză de garanție).</Strong> Proprietarul se obligă să despăgubească
        și să exonereze de răspundere RZRV pentru orice pretenție, cerere, acțiune, daună, pierdere,
        cost sau cheltuială (inclusiv cheltuieli rezonabile de judecată și onorarii de avocat)
        formulată de un chiriaș sau de orice terț și care derivă din: (i) utilizarea, starea sau
        siguranța spațiului său; (ii) informațiile publicate de proprietar; (iii) nerespectarea de
        către proprietar a obligațiilor legale, fiscale sau contractuale; (iv) orice incident produs
        în legătură cu spațiul închiriat. În mod similar, fiecare utilizator (proprietar sau chiriaș)
        răspunde pentru prejudiciile cauzate prin propria încălcare a acestor Termeni sau a legii.
      </P>

      <H2>4. Conturile utilizatorilor</H2>
      <P>
        4.1. Anumite funcționalități necesită crearea unui cont. Vă angajați să furnizați informații
        corecte și actuale.
      </P>
      <P>
        4.2. Sunteți responsabil pentru păstrarea confidențialității datelor de autentificare și
        pentru activitățile desfășurate prin contul dumneavoastră.
      </P>
      <P>
        4.3. Ne rezervăm dreptul de a suspenda sau șterge conturi care încalcă acești Termeni sau
        legislația aplicabilă.
      </P>

      <H2>5. Obligațiile proprietarilor</H2>
      <P>Proprietarii care listează spații se angajează:</P>
      <UL>
        <li>
          să furnizeze informații corecte și actuale despre spații (descriere, adresă, tarife,
          program, disponibilitate);
        </li>
        <li>să dețină dreptul legal de a închiria spațiile listate;</li>
        <li>să onoreze rezervările confirmate;</li>
        <li>să respecte legislația aplicabilă (inclusiv fiscală și de siguranță);</li>
        <li>să comunice corect cu chiriașii.</li>
      </UL>
      <P>
        <Strong>Responsabilitatea fiscală.</Strong> Proprietarul poartă responsabilitatea exclusivă și
        integrală pentru încasarea legală a tarifelor, emiterea documentelor fiscale aferente (bon
        fiscal și/sau factură, după caz), înregistrarea veniturilor și plata tuturor taxelor și
        impozitelor datorate. RZRV este strict o platformă de intermediere a rezervărilor și{" "}
        <Strong>nu are nicio responsabilitate</Strong> privind încasarea, fiscalizarea sau raportarea
        sumelor plătite direct între chiriaș și proprietar.
      </P>
      <P>
        <Strong>Siguranța spațiului.</Strong> Proprietarul este responsabil pentru conformitatea
        spațiului cu normele legale de siguranță, sănătate și protecție împotriva incendiilor
        aplicabile activității desfășurate.
      </P>

      <H2>6. Obligațiile chiriașilor</H2>
      <P>Chiriașii se angajează:</P>
      <UL>
        <li>să furnizeze date corecte la efectuarea rezervărilor;</li>
        <li>
          să onoreze rezervările confirmate sau să le anuleze din timp, conform regulilor spațiului;
        </li>
        <li>să utilizeze spațiile în mod responsabil și conform destinației;</li>
        <li>să respecte regulile stabilite de proprietar.</li>
      </UL>

      <H2>7. Rezervări</H2>
      <P>
        7.1. O rezervare poate fi <Strong>confirmată automat</Strong> (rezervare instant) sau poate
        necesita <Strong>aprobarea proprietarului</Strong>, în funcție de setările spațiului.
      </P>
      <P>
        7.2. Rezervările pot fi <Strong>anulate</Strong> conform regulilor aplicabile fiecărui spațiu
        și funcționalităților Platformei. Consecințele anulării (ex. disponibilitatea reprogramării)
        țin de înțelegerea dintre proprietar și chiriaș.
      </P>
      <P>
        7.3. RZRV transmite e-mailuri tranzacționale (confirmări, notificări, modificări de status)
        pentru a facilita comunicarea, dar nu garantează livrarea acestora.
      </P>

      <H2>8. Conținutul utilizatorilor</H2>
      <P>
        8.1. Proprietarii sunt responsabili pentru conținutul pe care îl publică (descrieri,
        fotografii). Prin publicare, garantați că dețineți drepturile asupra acestui conținut și că
        nu încalcă drepturile terților.
      </P>
      <P>
        8.2. Ne rezervăm dreptul de a elimina conținut care încalcă acești Termeni, legislația sau
        drepturile terților.
      </P>

      <H2>9. Proprietate intelectuală</H2>
      <P>
        Platforma, inclusiv designul, codul și elementele grafice (cu excepția conținutului furnizat
        de utilizatori), aparțin RZRV și sunt protejate de legislația privind proprietatea
        intelectuală. Nu aveți dreptul de a le copia sau utiliza fără acordul nostru.
      </P>

      <H2>10. Protecția datelor</H2>
      <P>
        Prelucrarea datelor cu caracter personal este descrisă în{" "}
        <Link to="/politica-confidentialitate" className="text-primary underline underline-offset-4">
          Politica de Confidențialitate
        </Link>
        .
      </P>

      <H2>11. Modificarea Termenilor</H2>
      <P>
        Putem modifica acești Termeni. Versiunea actualizată va fi publicată pe această pagină.
        Continuarea utilizării Platformei după modificare constituie acceptarea noilor Termeni.
      </P>

      <H2>12. Legea aplicabilă și litigii</H2>
      <P>12.1. Acești Termeni sunt guvernați de legea română.</P>
      <P>
        12.2. Eventualele litigii se soluționează pe cale amiabilă. În caz contrar, sunt de competența
        instanțelor române.
      </P>
      <P>
        12.3. Consumatorii pot recurge la platforma europeană de soluționare online a litigiilor
        (SOL):{" "}
        <a
          href="https://ec.europa.eu/consumers/odr"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-4"
        >
          https://ec.europa.eu/consumers/odr
        </a>
        .
      </P>

      <H2>13. Contact</H2>
      <P>
        Pentru întrebări legate de acești Termeni: <Strong>E-mail:</Strong>{" "}
        <a href="mailto:contact@rzrv.ro" className="text-primary underline underline-offset-4">
          contact@rzrv.ro
        </a>
      </P>

      <Note>
        Notă: prevederile referitoare la ANPC, dreptul de retragere și obligațiile specifice
        comerțului electronic devin relevante atunci când se introduc plăți prin Platformă.
      </Note>
    </LegalPage>
  );
}
