"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { useProSession } from "@/lib/hooks/useSession";
import { LIBELLE_ROLE, estCoordOuManager, estRoleService, peutMarketing } from "@/lib/roles";
import { peutNotesFrais } from "@/lib/notesFrais";
import { TYPES_ORDO_PHARMACIE, clePharmaVu } from "@/lib/ordonnances";
import { RechercheSoignants } from "@/components/RechercheSoignants";
import { Avatar } from "@/components/Avatar";

export default function ProLayout({ children }: { children: React.ReactNode }) {
  const pro = useProSession();
  const pathname = usePathname();
  const estN0 = pro?.niveau === 0; // super-admin plateforme : accès à tout
  const estCoord = estCoordOuManager(pro?.role) || estN0;
  const estChir = pro?.role === "chirurgien" && !estN0;
  const estLivreur = pro?.role === "livreur" && !estN0;
  // La pharmacie n'a accès qu'à son listing de patients (aucun autre onglet).
  const estPharmacie = pro?.role === "pharmacie" && !estN0;
  // Le dirigeant : pas de tableau de bord ; PEC (nationale) + équipe dirigeante.
  const estDirigeant = pro?.role === "dirigeant" && !estN0;
  // Le magasinier : gère le stock et prépare les commandes (Magasin + Préparations).
  const estMagasinier = pro?.role === "magasinier" && !estN0;
  // Le RH : hors hiérarchie, aucun accès patient ; annuaire de toutes les équipes.
  const estRh = pro?.role === "rh" && !estN0;
  // Le personnel : compte interne générique, hors hiérarchie (messagerie seule).
  const estPersonnel = pro?.role === "personnel" && !estN0;
  // Annuaire des équipes (+ gestion des postes) : RH, dirigeant, manager, admin.
  const peutAnnuaire = estN0 || pro?.role === "manager";
  // Espace Marketing : dirigeant, RH, manager, délégué (+ admin).
  const peutMkt = peutMarketing(pro?.role, pro?.niveau);
  // Notes de frais : tout le personnel interne (pas les partenaires externes).
  const peutNdf = peutNotesFrais(pro?.role);
  // Gérer/créer des comptes & l'équipe : niveau 0, 1 ou 2 (hors chirurgien et
  // hors comptes service livreur/pharmacie)
  const peutGerer = estN0 || (!!pro && pro.niveau <= 2 && pro.role !== "chirurgien" && !estRoleService(pro.role));
  // PEC : managers (niveau 1) et plateforme (niveau 0)
  const peutPec = !!pro && pro.niveau <= 1;

  // Demandes de planning en attente dans le périmètre (badge Organisation).
  // Rafraîchissement auto des compteurs/notifications (sans recharger la page) :
  // toutes les 30 s + au retour sur l'onglet. « tick » est dans les deps des effets.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const onVis = () => { if (document.visibilityState === "visible") bump(); };
    const id = setInterval(bump, 30_000);
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); window.removeEventListener("focus", bump); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  // Temps réel : ordonnance (À signer) + messagerie. Mise à jour instantanée du
  // badge dès qu'une ligne me concernant change (RLS respectée côté Realtime).
  useEffect(() => {
    if (!pro?.id) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`notif-pro-${pro.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ordonnance", filter: `destinataire_id=eq.${pro.id}` }, () => setTick((t) => t + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "message_pro", filter: `destinataire_id=eq.${pro.id}` }, () => setTick((t) => t + 1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pro?.id]);

  const [nbDemandes, setNbDemandes] = useState(0);
  useEffect(() => {
    if (!pro || pro.niveau !== 1) return; // seul le manager valide
    const supabase = createClient();
    Promise.all([
      supabase.from("evenement_planning").select("professionnel:professionnel_id(agence_id)").eq("statut", "en_attente"),
      supabase.from("agence").select("id,region_id"),
    ]).then(([{ data: evts }, { data: ags }]) => {
      const regionAgence = new Map((ags ?? []).map((a) => [a.id as string, a.region_id as string]));
      const maRegion = pro.region_id ?? (pro.agence_id ? regionAgence.get(pro.agence_id) : undefined);
      const n = (evts ?? []).filter((e) => {
        const agId = (e.professionnel as { agence_id?: string } | null)?.agence_id;
        return !!agId && regionAgence.get(agId) === maRegion;
      }).length;
      setNbDemandes(n);
    });
  }, [pro, pathname, tick]);

  // Suivis du jour + en retard attribués au compte connecté (badge Suivis).
  const [nbSuivis, setNbSuivis] = useState(0);
  useEffect(() => {
    if (!pro || !estCoord) return;
    const monNom = [pro.titre, pro.prenom, pro.nom].filter(Boolean).join(" ");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const limiteBasse = new Date(today); limiteBasse.setDate(limiteBasse.getDate() - 7);
    createClient()
      .from("patient")
      .select("statut,date_operation,jours_suivi,alerte_1_nom")
      .eq("alerte_1_nom", monNom)
      .then(({ data }) => {
        let n = 0;
        (data ?? []).forEach((p) => {
          const x = p as { statut: string; date_operation: string | null; jours_suivi: number[] | null };
          if (!x.date_operation || x.statut !== "active") return;
          const base = new Date(x.date_operation);
          if (isNaN(base.getTime())) return;
          (x.jours_suivi ?? []).forEach((j) => {
            const d = new Date(base); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + j);
            if (d.getTime() <= today.getTime() && d.getTime() >= limiteBasse.getTime()) n++;
          });
        });
        setNbSuivis(n);
      });
  }, [pro, estCoord, pathname, tick]);

  // Ordonnances en attente de signature pour le médecin connecté (badge À signer).
  const [nbASigner, setNbASigner] = useState(0);
  useEffect(() => {
    if (!pro || !estChir) return;
    createClient()
      .from("ordonnance")
      .select("id", { count: "exact", head: true })
      .eq("destinataire_id", pro.id)
      .eq("statut", "a_signer")
      .then(({ count }) => setNbASigner(count ?? 0));
  }, [pro, estChir, pathname, tick]);

  // Ordonnances pharmacie signées reçues depuis la dernière visite (badge pharmacie).
  const [nbOrdoPharma, setNbOrdoPharma] = useState(0);
  useEffect(() => {
    if (!pro || !estPharmacie) return;
    const supabase = createClient();
    supabase.from("patient").select("id").then(async ({ data: pts }) => {
      const ids = (pts ?? []).map((p) => p.id as string);
      if (!ids.length) { setNbOrdoPharma(0); return; }
      const { data: ords } = await supabase
        .from("ordonnance")
        .select("signee_le")
        .in("patient_id", ids)
        .in("type", TYPES_ORDO_PHARMACIE as readonly string[])
        .eq("statut", "signee");
      let vu = 0;
      try { vu = Number(localStorage.getItem(clePharmaVu(pro.id))) || 0; } catch { /* */ }
      const n = (ords ?? []).filter((o) => {
        const t = o.signee_le ? new Date(o.signee_le as string).getTime() : 0;
        return t > vu;
      }).length;
      setNbOrdoPharma(n);
    });
  }, [pro, estPharmacie, pathname, tick]);

  // Messages internes non lus (badge Messagerie).
  const [nbMessages, setNbMessages] = useState(0);
  useEffect(() => {
    if (!pro) return;
    createClient()
      .from("message_pro")
      .select("id", { count: "exact", head: true })
      .eq("destinataire_id", pro.id)
      .eq("lu", false)
      .then(({ count }) => setNbMessages(count ?? 0));
  }, [pro, pathname, tick]);

  // Alertes parc matériel (maintenance en retard + location trop longue) — badge magasinier.
  const [nbParc, setNbParc] = useState(0);
  useEffect(() => {
    if (!pro || !estMagasinier) return;
    createClient()
      .from("equipement")
      .select("statut,prochaine_maintenance,chez_patient_depuis,article:article_code(location_max_jours)")
      .then(({ data }) => {
        const today = new Date().toISOString().slice(0, 10);
        let n = 0;
        (data ?? []).forEach((e) => {
          const x = e as { statut: string; prochaine_maintenance: string | null; chez_patient_depuis: string | null; article: { location_max_jours: number | null } | { location_max_jours: number | null }[] | null };
          if (x.statut === "hors_service") return;
          if (x.prochaine_maintenance && x.prochaine_maintenance < today) { n++; return; }
          const max = (Array.isArray(x.article) ? x.article[0]?.location_max_jours : x.article?.location_max_jours) ?? null;
          if (x.statut === "chez_patient" && x.chez_patient_depuis && max && (Date.now() - new Date(x.chez_patient_depuis).getTime()) / 86_400_000 > max) n++;
        });
        setNbParc(n);
      });
  }, [pro, estMagasinier, pathname, tick]);

  // Menu « Plus » de la barre mobile (overflow au-delà de 5 entrées).
  const [menuOuvert, setMenuOuvert] = useState(false);

  // Remonte en haut + referme le menu « Plus » à chaque changement de page.
  useEffect(() => { window.scrollTo(0, 0); setMenuOuvert(false); }, [pathname]);

  // Entrées de navigation pour la barre mobile, par ordre de priorité.
  // Les comptes service (livreur/pharmacie) n'ont qu'une seule entrée.
  type NavEntree = { href: string; icon: string; label: string; badge?: number };
  const entreesMobile: NavEntree[] = estPharmacie
    ? [{ href: "/pro/pharmacie", icon: "clipboard", label: "Mes patients", badge: nbOrdoPharma }]
    : estLivreur
    ? [
        { href: "/pro/livraisons", icon: "truck", label: "Tournée" },
        { href: "/pro/agenda", icon: "calendar", label: "Agenda" },
        { href: "/pro/magasin", icon: "box", label: "Magasin" },
        { href: "/pro/notes-frais", icon: "recu", label: "Notes de frais" },
      ]
    : estDirigeant
    ? [
        { href: "/pro/pec", icon: "chart", label: "PEC" },
        { href: "/pro/annuaire", icon: "users", label: "Annuaire" },
        { href: "/pro/marketing", icon: "megaphone", label: "Marketing" },
        { href: "/pro/notes-frais", icon: "recu", label: "Notes de frais" },
        { href: "/pro/equipe-dirigeante", icon: "users", label: "Équipe dirigeante" },
      ]
    : estMagasinier
    ? [
        { href: "/pro/magasin", icon: "box", label: "Magasin" },
        { href: "/pro/preparations", icon: "prep", label: "Préparations" },
        { href: "/pro/parc", icon: "parc", label: "Parc", badge: nbParc },
        { href: "/pro/notes-frais", icon: "recu", label: "Notes de frais" },
      ]
    : estRh
    ? [
        { href: "/pro/annuaire", icon: "users", label: "Annuaire" },
        { href: "/pro/marketing", icon: "megaphone", label: "Marketing" },
        { href: "/pro/notes-frais", icon: "recu", label: "Notes de frais" },
        { href: "/pro/messagerie", icon: "message", label: "Messages", badge: nbMessages },
      ]
    : estPersonnel
    ? [
        { href: "/pro/notes-frais", icon: "recu", label: "Notes de frais" },
        { href: "/pro/messagerie", icon: "message", label: "Messages", badge: nbMessages },
      ]
    : [
        { href: "/pro", icon: "dashboard", label: "Tableau" },
        ...(estCoord ? [{ href: "/pro/agenda", icon: "calendar", label: "Agenda", badge: nbSuivis + nbDemandes }] : []),
        ...(estCoord ? [{ href: "/pro/livraisons", icon: "truck", label: "Ma tournée" }] : []),
        ...(pro?.role === "coordinatrice" || estN0 ? [{ href: "/pro/magasin", icon: "box", label: "Magasin" }] : []),
        ...(estChir ? [{ href: "/pro/a-signer", icon: "document", label: "À signer", badge: nbASigner }] : []),
        { href: "/pro/messagerie", icon: "message", label: "Messages", badge: nbMessages },
        ...(peutGerer ? [{ href: "/pro/equipe", icon: "users", label: "Équipe" }] : []),
        ...(peutAnnuaire ? [{ href: "/pro/annuaire", icon: "users", label: "Annuaire" }] : []),
        ...(peutMkt ? [{ href: "/pro/marketing", icon: "megaphone", label: "Marketing" }] : []),
        ...(peutNdf ? [{ href: "/pro/notes-frais", icon: "recu", label: "Notes de frais" }] : []),
        ...(peutPec ? [{ href: "/pro/pec", icon: "chart", label: "PEC" }] : []),
      ];
  // Au-delà de 5 entrées : 4 visibles + un bouton « Plus » qui ouvre le reste.
  const enDebordement = entreesMobile.length > 5;
  const entreesVisibles = enDebordement ? entreesMobile.slice(0, 4) : entreesMobile;
  const entreesPlus = enDebordement ? entreesMobile.slice(4) : [];
  const badgePlus = entreesPlus.reduce((s, e) => s + (e.badge ?? 0), 0);

  return (
    <div className="min-h-screen">
      <header className="border-b border-rose-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            <Logo />
            <nav className="hidden items-center gap-0.5 sm:flex">
              {!pro ? null : estPharmacie ? (
                <Onglet href="/pro/pharmacie" icon="clipboard" label="Mes patients" pathname={pathname} badge={nbOrdoPharma} />
              ) : estLivreur ? (
                <>
                  <Onglet href="/pro/livraisons" icon="truck" label="Tournée" pathname={pathname} />
                  <Onglet href="/pro/agenda" icon="calendar" label="Agenda" pathname={pathname} />
                  <Onglet href="/pro/magasin" icon="box" label="Magasin" pathname={pathname} />
                  <Onglet href="/pro/notes-frais" icon="recu" label="Notes de frais" pathname={pathname} />
                </>
              ) : estDirigeant ? (
                <>
                  <Onglet href="/pro/pec" icon="chart" label="PEC" pathname={pathname} />
                  <Onglet href="/pro/annuaire" icon="users" label="Annuaire des équipes" pathname={pathname} />
                  <Onglet href="/pro/marketing" icon="megaphone" label="Marketing" pathname={pathname} />
                  <Onglet href="/pro/notes-frais" icon="recu" label="Notes de frais" pathname={pathname} />
                  <Onglet href="/pro/equipe-dirigeante" icon="users" label="Équipe dirigeante" pathname={pathname} />
                </>
              ) : estMagasinier ? (
                <>
                  <Onglet href="/pro/magasin" icon="box" label="Magasin" pathname={pathname} />
                  <Onglet href="/pro/preparations" icon="prep" label="Préparations" pathname={pathname} />
                  <Onglet href="/pro/parc" icon="parc" label="Parc" pathname={pathname} badge={nbParc} />
                  <Onglet href="/pro/notes-frais" icon="recu" label="Notes de frais" pathname={pathname} />
                </>
              ) : estRh ? (
                <>
                  <Onglet href="/pro/annuaire" icon="users" label="Annuaire des équipes" pathname={pathname} />
                  <Onglet href="/pro/marketing" icon="megaphone" label="Marketing" pathname={pathname} />
                  <Onglet href="/pro/notes-frais" icon="recu" label="Notes de frais" pathname={pathname} />
                  <Onglet href="/pro/messagerie" icon="message" label="Messagerie" pathname={pathname} badge={nbMessages} />
                </>
              ) : estPersonnel ? (
                <>
                  <Onglet href="/pro/notes-frais" icon="recu" label="Notes de frais" pathname={pathname} />
                  <Onglet href="/pro/messagerie" icon="message" label="Messagerie" pathname={pathname} badge={nbMessages} />
                </>
              ) : (
                <>
                  <Onglet href="/pro" icon="dashboard" label="Tableau de bord" pathname={pathname} exact />
                  {estCoord && <Onglet href="/pro/agenda" icon="calendar" label="Agenda" pathname={pathname} badge={nbSuivis + nbDemandes} />}
                  {estCoord && <Onglet href="/pro/livraisons" icon="truck" label="Ma tournée" pathname={pathname} />}
                  {(pro?.role === "coordinatrice" || estN0) && <Onglet href="/pro/magasin" icon="box" label="Magasin" pathname={pathname} />}
                  {estChir && <Onglet href="/pro/a-signer" icon="document" label="À signer" pathname={pathname} badge={nbASigner} />}
                  {peutGerer && <Onglet href="/pro/equipe" icon="users" label="Équipe soignante" pathname={pathname} />}
                  {peutAnnuaire && <Onglet href="/pro/annuaire" icon="users" label="Annuaire des équipes" pathname={pathname} />}
                  {peutMkt && <Onglet href="/pro/marketing" icon="megaphone" label="Marketing" pathname={pathname} />}
                  {peutNdf && <Onglet href="/pro/notes-frais" icon="recu" label="Notes de frais" pathname={pathname} />}
                  <Onglet href="/pro/messagerie" icon="message" label="Messagerie" pathname={pathname} badge={nbMessages} />
                  {peutPec && <Onglet href="/pro/pec" icon="chart" label="PEC" pathname={pathname} />}
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-right">
            {peutGerer && <RechercheSoignants />}
            {(estCoord || estChir || peutGerer) && (
              <Link
                href="/pro/nouveau"
                prefetch={true}
                className="hidden items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark sm:inline-flex"
              >
                <IconeNav name="plus" className="h-4 w-4" />
                Nouveau
              </Link>
            )}
            {pro && (
              <Link href="/pro/profil" prefetch className="flex items-center gap-2 rounded-lg px-2 py-1 text-left transition hover:bg-rose-50" title="Mon profil">
                <Avatar url={pro.photo_url} prenom={pro.prenom} nom={pro.nom} taille="sm" />
                <span className="hidden leading-tight sm:block">
                  <span className="block text-sm font-semibold text-slate-700">
                    {[pro.titre, pro.prenom, pro.nom].filter(Boolean).join(" ")}
                  </span>
                  <span className="block text-xs text-slate-400">{LIBELLE_ROLE[pro.role as keyof typeof LIBELLE_ROLE]}</span>
                </span>
              </Link>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl overflow-x-clip px-4 py-6 pb-24 sm:px-6 sm:pb-6">{children}</main>

      {/* Feuille « Plus » : entrées qui débordent de la barre mobile. */}
      {menuOuvert && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/30 sm:hidden" onClick={() => setMenuOuvert(false)} />
          <div className="fixed inset-x-3 bottom-[4.25rem] z-50 overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-xl sm:hidden">
            {entreesPlus.map((e) => {
              const actif = pathname === e.href || (e.href !== "/pro" && pathname.startsWith(e.href));
              return (
                <Link
                  key={e.href}
                  href={e.href}
                  prefetch
                  onClick={() => setMenuOuvert(false)}
                  className={`flex items-center gap-3 border-b border-rose-50 px-4 py-3.5 text-sm font-medium transition-colors last:border-0 ${
                    actif ? "bg-rose-50 text-brand" : "text-slate-600 hover:bg-rose-50"
                  }`}
                >
                  <IconeNav name={e.icon} className="h-5 w-5 shrink-0" />
                  <span>{e.label}</span>
                  {!!e.badge && e.badge > 0 && (
                    <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-white">{e.badge}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* Bouton flottant « Nouveau » (mobile) : toujours visible en bas à droite. */}
      {pro && (estCoord || estChir || peutGerer) && (
        <Link
          href="/pro/nouveau"
          prefetch
          aria-label="Nouveau"
          title="Nouveau"
          className="fixed bottom-[4.75rem] right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg transition active:scale-95 sm:hidden"
        >
          <IconeNav name="plus" className="h-6 w-6" />
        </Link>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-rose-100 bg-white sm:hidden">
        {!pro ? (
          // Session pas encore connue : squelette (jamais la navbar réduite « 2 entrées »).
          <NavSkeleton />
        ) : (
        <>
        {entreesVisibles.map((e) => (
          <NavItem key={e.href} href={e.href} icon={e.icon} label={e.label} badge={e.badge} pathname={pathname} />
        ))}
        {enDebordement && (
          <button
            type="button"
            onClick={() => setMenuOuvert((v) => !v)}
            className={`relative flex flex-1 flex-col items-center gap-1 py-2 transition-colors ${
              menuOuvert ? "text-brand" : "text-slate-400 hover:text-brand"
            }`}
          >
            {!menuOuvert && badgePlus > 0 && (
              <span className="absolute right-1/2 top-0.5 flex h-[15px] min-w-[15px] translate-x-3 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-semibold leading-none text-white ring-2 ring-white">{badgePlus}</span>
            )}
            <IconeNav name="ellipsis" className="h-5 w-5" />
            <span className="text-[10px] font-medium">Plus</span>
          </button>
        )}
        </>
        )}
      </nav>
    </div>
  );
}

// Squelette de la barre mobile pendant le chargement de la session (évite la
// navbar réduite « Tableau + Messages » quand `pro` n'est pas encore connu).
function NavSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1 py-2">
          <span className="h-5 w-5 animate-pulse rounded-md bg-rose-100" />
          <span className="h-2 w-8 animate-pulse rounded bg-rose-50" />
        </div>
      ))}
    </>
  );
}

function NavItem({ href, icon, label, badge, pathname }: { href: string; icon: string; label: string; badge?: number; pathname?: string }) {
  const actif = pathname != null && (pathname === href || (href !== "/pro" && pathname.startsWith(href)));
  return (
    <Link
      href={href}
      prefetch={true}
      className={`relative flex flex-1 flex-col items-center gap-1 py-2 transition-colors ${
        actif ? "text-brand" : "text-slate-400 hover:text-brand"
      }`}
    >
      {!!badge && badge > 0 && (
        <span className="absolute right-1/2 top-0.5 flex h-[15px] min-w-[15px] translate-x-3 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-semibold leading-none text-white ring-2 ring-white">{badge}</span>
      )}
      <IconeNav name={icon} className="h-5 w-5" />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

function Onglet({ href, icon, label, pathname, exact, badge }: { href: string; icon: string; label: string; pathname: string; exact?: boolean; badge?: number }) {
  const actif = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      prefetch={true}
      title={label}
      className={`group relative flex h-10 items-center justify-center rounded-lg px-2.5 text-sm font-medium transition-colors ${
        actif ? "bg-rose-50 text-brand" : "text-slate-500 hover:bg-rose-50 hover:text-brand"
      }`}
    >
      <IconeNav name={icon} className="block h-5 w-5 shrink-0" />
      {/* Libellé : affiché si actif, sinon au survol (animation de largeur) */}
      <span
        className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-out ${
          actif ? "ml-1.5 max-w-[14rem]" : "max-w-0 group-hover:ml-1.5 group-hover:max-w-[14rem]"
        }`}
      >
        {label}
      </span>
      {!!badge && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-brand px-1 text-[9px] font-semibold leading-none text-white ring-2 ring-white">{badge}</span>
      )}
    </Link>
  );
}

// Icônes de navigation (style ligne, cohérent — pas d'emoji).
function IconeNav({ name, className }: { name: string; className?: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    dashboard: (<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>),
    bell: (<><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7 2.5 7H3.5S6 15 6 9Z" /><path d="M10.5 21a1.8 1.8 0 0 0 3 0" /></>),
    chart: (<><line x1="6" y1="20" x2="6" y2="13" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="18" y1="20" x2="18" y2="9" /></>),
    calendar: (<><rect x="3" y="4.5" width="18" height="17" rx="2" /><line x1="8" y1="2.5" x2="8" y2="6" /><line x1="16" y1="2.5" x2="16" y2="6" /><line x1="3" y1="9.5" x2="21" y2="9.5" /><path d="m8.5 14.5 2 2 3.5-3.5" /></>),
    clipboard: (<><rect x="8" y="3" width="8" height="4" rx="1" /><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" /></>),
    users: (<><path d="M16 21v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V21" /><circle cx="9" cy="7" r="3.5" /><path d="M22 21v-1.5a4 4 0 0 0-3-3.85" /><path d="M16 3.6a3.5 3.5 0 0 1 0 6.8" /></>),
    home: (<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></>),
    plus: (<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>),
    message: (<><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" /></>),
    document: (<><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></>),
    truck: (<><path d="M3 6h11v9H3z" /><path d="M14 9h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></>),
    ellipsis: (<><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" /></>),
    box: (<><path d="m3 7.5 9-4.5 9 4.5v9l-9 4.5-9-4.5z" /><path d="m3 7.5 9 4.5 9-4.5" /><path d="M12 12v9" /></>),
    prep: (<><rect x="8" y="3" width="8" height="4" rx="1" /><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></>),
    parc: (<><rect x="3" y="4.5" width="18" height="12" rx="2" /><line x1="8.5" y1="20" x2="15.5" y2="20" /><line x1="12" y1="16.5" x2="12" y2="20" /><path d="M7.5 10.5h2l1-2 1.5 4 1-2h3.5" /></>),
    megaphone: (<><path d="M4 10.5v3a1 1 0 0 0 1 1h2.5l6 3.5V6l-6 3.5H5a1 1 0 0 0-1 1Z" /><path d="M16.5 9.5a3.5 3.5 0 0 1 0 5" /><path d="M7.5 14.5 9 20" /></>),
    recu: (<><path d="M6 3h12v18l-2.3-1.4L13.5 21 12 19.6 10.5 21 8.3 19.6 6 21z" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="9" y1="12" x2="15" y2="12" /></>),
  };
  return (
    <svg viewBox="0 0 24 24" className={className} {...p} aria-hidden="true">
      {paths[name] ?? paths.dashboard}
    </svg>
  );
}
