// Allowlist des administrateurs autorisés à créer des comptes soignants.
// SERVEUR UNIQUEMENT — lit la variable d'env ADMIN_EMAILS (emails séparés par
// des virgules). Par défaut : le compte propriétaire.
// Pour ajouter le cousin : définir ADMIN_EMAILS="bymrts.pro@gmail.com,cousin@email.fr".
export function emailsAdmin(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "bymrts.pro@gmail.com,biotcorentin93@gmail.com";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function estEmailAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return emailsAdmin().includes(email.toLowerCase());
}
