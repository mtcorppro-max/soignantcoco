import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emailDepuisCode } from "@/lib/constants";

// Login patient par code unique.
// Convention prototype (cf. 0001_init.sql) : le compte Auth du patient a pour
// email `<code>@patient.soignantcoco.local` et pour mot de passe le code.
// On ouvre donc une session côté serveur ; les cookies sont posés par le
// client SSR. En production, à remplacer par une Edge Function dédiée.
export async function POST(request: Request) {
  const { code } = await request.json().catch(() => ({ code: "" }));

  if (!code || typeof code !== "string" || code.trim().length < 4) {
    return NextResponse.json(
      { message: "Code requis." },
      { status: 400 }
    );
  }

  const codeNorm = code.trim();
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: emailDepuisCode(codeNorm),
    password: codeNorm,
  });

  if (error) {
    return NextResponse.json(
      { message: "Code invalide ou suivi clôturé." },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}
