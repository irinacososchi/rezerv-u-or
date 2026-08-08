import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, H2, H3, P, UL, Strong, Note, Table } from "@/components/legal-page";

const TITLE = "Politica de Cookies — RZRV";
const DESC =
  "Ce cookie-uri și tehnologii de stocare locală folosește RZRV: doar cele strict necesare funcționării, plus analiză de trafic fără cookie-uri, fără tracking de marketing.";

export const Route = createFileRoute("/politica-cookies")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <LegalPage title="Politica de Cookies" updatedAt="8 august 2026">
      <H2>1. Ce sunt cookie-urile și tehnologiile similare</H2>
      <P>
        Cookie-urile sunt fișiere text de mici dimensiuni stocate pe dispozitivul dumneavoastră atunci
        când vizitați un site. Tehnologii similare (precum{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[13px]">localStorage</code>) permit stocarea
        locală a unor informații în browser.
      </P>
      <P>
        Platforma <Strong>RZRV</Strong> (rzrv.ro) utilizează un set minim de astfel de tehnologii,{" "}
        <Strong>strict necesare funcționării</Strong>.
      </P>

      <H2>2. Ce utilizăm și de ce</H2>
      <P>RZRV folosește următoarele categorii de stocare locală:</P>

      <H3>2.1. Strict necesare (nu pot fi dezactivate)</H3>
      <Table
        headers={["Tehnologie", "Scop", "Durată"]}
        rows={[
          [
            "Cookie/stocare de sesiune (autentificare)",
            "Menținerea stării de autentificare, astfel încât să rămâneți conectat între pagini",
            "Pe durata sesiunii / până la deconectare",
          ],
          [
            <>
              <code className="rounded bg-muted px-1 py-0.5 text-[13px]">localStorage</code> —
              preferințe
            </>,
            "Reținerea unor preferințe funcționale (ex. lista de spații favorite pentru vizitatori, preferința de vizualizare a calendarului)",
            "Până la ștergerea manuală din browser",
          ],
        ]}
      />
      <P>
        Aceste tehnologii sunt esențiale pentru funcționarea Platformei. Fără ele, autentificarea și
        anumite funcționalități nu ar funcționa corect. Temeiul legal este interesul legitim de a
        furniza un serviciu funcțional, respectiv necesitatea tehnică.
      </P>

      <H3>2.2. Analiză de trafic (fără cookie-uri)</H3>
      <P>
        Folosim un sistem de <Strong>analiză a traficului fără cookie-uri</Strong>, furnizat de
        platforma de găzduire. Acesta măsoară în mod <Strong>agregat</Strong>: numărul de vizitatori,
        paginile vizitate, sursa vizitei, tipul de dispozitiv și țara (estimată din fusul orar al
        browserului). Nu se creează profiluri de utilizator,{" "}
        <Strong>nu se stochează identificatori pe dispozitivul dumneavoastră</Strong> și nu urmărim
        vizitatorii între vizite.
      </P>
      <P>
        Deoarece acest sistem{" "}
        <Strong>nu accesează și nu stochează informații pe dispozitivul dumneavoastră</Strong> (nu
        folosește cookie-uri sau tehnologii echivalente), nu necesită un consimțământ prealabil de tip
        „banner de cookie-uri".
      </P>

      <H3>2.3. Ce NU folosim</H3>
      <P>
        RZRV <Strong>nu utilizează</Strong>:
      </P>
      <UL>
        <li>cookie-uri de publicitate sau marketing;</li>
        <li>cookie-uri de urmărire (tracking) în scopuri publicitare;</li>
        <li>instrumente de profilare a comportamentului în scopuri comerciale.</li>
      </UL>

      <H2>3. Cookie-uri ale terților</H2>
      <P>
        Anumite servicii pe care le folosim pentru funcționarea Platformei (de exemplu infrastructura
        de găzduire și securitate, precum Cloudflare, sau autentificarea prin Supabase) pot seta
        cookie-uri tehnice necesare securității și funcționării. Acestea nu sunt utilizate de noi în
        scopuri de marketing.
      </P>

      <H2>4. Cum controlați cookie-urile</H2>
      <P>Puteți controla și șterge stocarea locală din setările browserului dumneavoastră:</P>
      <UL>
        <li>ștergerea cookie-urilor și a datelor de site;</li>
        <li>
          blocarea cookie-urilor (rețineți că blocarea celor strict necesare poate afecta funcționarea
          Platformei, inclusiv autentificarea).
        </li>
      </UL>
      <P>Instrucțiuni pentru browsere uzuale:</P>
      <UL>
        <li>
          <Strong>Chrome:</Strong> Setări → Confidențialitate și securitate → Cookie-uri
        </li>
        <li>
          <Strong>Firefox:</Strong> Setări → Confidențialitate și securitate
        </li>
        <li>
          <Strong>Safari:</Strong> Preferințe → Confidențialitate
        </li>
        <li>
          <Strong>Edge:</Strong> Setări → Cookie-uri și permisiuni site
        </li>
      </UL>

      <H2>5. Modificări</H2>
      <P>
        Putem actualiza această Politică de Cookies pentru a reflecta modificări ale tehnologiilor
        utilizate. Versiunea actualizată va fi publicată pe această pagină.
      </P>

      <H2>6. Contact</H2>
      <P>
        Pentru întrebări legate de această politică: <Strong>E-mail:</Strong>{" "}
        <a href="mailto:contact@rzrv.ro" className="text-primary underline underline-offset-4">
          contact@rzrv.ro
        </a>
      </P>

      <Note>
        Acest document constituie un draft inițial și reflectă utilizarea actuală a Platformei:
        stocare strict necesară funcționării, plus un sistem de analiză a traficului fără cookie-uri
        și fără profilare. Dacă în viitor se introduc instrumente de analiză bazate pe cookie-uri sau
        instrumente de marketing, această politică și, după caz, un mecanism de consimțământ (banner
        de cookie-uri) trebuie actualizate corespunzător.
      </Note>
    </LegalPage>
  );
}
