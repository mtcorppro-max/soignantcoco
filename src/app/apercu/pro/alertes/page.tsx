import { CadrePro } from "@/components/apercu/CadrePro";
import { AlerteCard, type AlerteEnrichie } from "@/components/AlerteCard";

const maintenant = new Date().toISOString();
const il2h = new Date(Date.now() - 2 * 3600000).toISOString();

const alertes: AlerteEnrichie[] = [
  {
    id: "a1",
    patient_id: "p1",
    mesure_id: "m1",
    statut: "declenchee",
    declenchee_le: maintenant,
    acquittee_par: null,
    acquittee_le: null,
    escalade_vers: null,
    escalade_le: null,
    escalade_note: null,
    resolue_le: null,
    canal: "push",
    patient: { id: "p1", nom: "Monsieur Démo" },
    mesure: { type: "temperature", valeur: 39.2, horodatage: maintenant },
  },
  {
    id: "a2",
    patient_id: "p2",
    mesure_id: "m2",
    statut: "acquittee",
    declenchee_le: il2h,
    acquittee_par: "pro1",
    acquittee_le: il2h,
    escalade_vers: null,
    escalade_le: null,
    escalade_note: null,
    resolue_le: null,
    canal: "sms_1",
    patient: { id: "p2", nom: "Madame Lefèvre" },
    mesure: { type: "spo2", valeur: 90, horodatage: il2h },
  },
  {
    id: "a3",
    patient_id: "p3",
    mesure_id: "m3",
    statut: "escaladee",
    declenchee_le: il2h,
    acquittee_par: "pro1",
    acquittee_le: il2h,
    escalade_vers: "Dr Martin, urgences CHU",
    escalade_le: maintenant,
    escalade_note: "patient adressé aux urgences à 14h32",
    resolue_le: null,
    canal: "telephone",
    patient: { id: "p3", nom: "Monsieur Nguyen" },
    mesure: { type: "ta_systolique", valeur: 178, horodatage: il2h },
  },
];

export default function ApercuProAlertes() {
  return (
    <CadrePro active="Alertes">
      <div className="grid gap-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Centre d&apos;alertes</h1>
          <p className="mt-1 text-sm text-slate-500">
            L&apos;escalade vers l&apos;hôpital est <strong>toujours une décision
            humaine</strong> : prévenez par téléphone, puis tracez-le ici.
          </p>
        </div>
        <div className="grid gap-3">
          {alertes.map((a) => (
            <AlerteCard key={a.id} alerte={a} peutTraiter proId="apercu" />
          ))}
        </div>
      </div>
    </CadrePro>
  );
}
