import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_CICATRICES } from "@/lib/photos";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({}, { status: 401 });

  const { chemins } = (await req.json()) as { chemins: string[] };
  if (!chemins?.length) return NextResponse.json({ urls: {} });

  const admin = createAdminClient();
  const { data } = await admin.storage
    .from(BUCKET_CICATRICES)
    .createSignedUrls(chemins, 3600);

  const urls: Record<string, string> = {};
  (data ?? []).forEach((item) => {
    if (item.signedUrl && item.path) urls[item.path] = item.signedUrl;
  });

  return NextResponse.json({ urls });
}
