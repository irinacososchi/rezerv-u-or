import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const CONTACT_RECIPIENT = "rzrv.contact@gmail.com";
const FROM_ADDRESS = "RZRV Contact <contact@rzrv.ro>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const escape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY nu este configurat.");
    }

    const { name, email, phone, description } = await req.json();

    if (
      !name ||
      typeof name !== "string" ||
      !email ||
      typeof email !== "string" ||
      !description ||
      typeof description !== "string"
    ) {
      return new Response(
        JSON.stringify({
          error: "Toate câmpurile obligatorii trebuie completate.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!emailOk) {
      return new Response(
        JSON.stringify({ error: "Adresa de email nu este validă." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const html = `
      <h2>Nou mesaj de contact RZRV</h2>
      <p><strong>Nume:</strong> ${escape(name)}</p>
      <p><strong>Email:</strong> ${escape(email)}</p>
      <p><strong>Telefon:</strong> ${phone ? escape(String(phone)) : "(nespecificat)"}</p>
      <hr />
      <p><strong>Descriere:</strong></p>
      <p style="white-space: pre-wrap;">${escape(description)}</p>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [CONTACT_RECIPIENT],
        reply_to: email,
        subject: `Mesaj contact RZRV de la ${name}`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errorText = await resendRes.text();
      throw new Error(`Resend error: ${errorText}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Eroare necunoscută";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
