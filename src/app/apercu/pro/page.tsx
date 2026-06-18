import Link from "next/link";
import { CadrePro } from "@/components/apercu/CadrePro";
import { mockPatients } from "@/lib/mock";

export default function ApercuProDashboard() {
  const tries = [...mockPatients].sort(
    (a, b) => b.actives * 100 + b.acquittees - (a.actives * 100 + a.acquittees)
  );
  const totalActives = mockPatients.reduce((s, p) => s + p.actives, 0);

  return (
    <CadrePro active="Tableau de bord">
      <div className="grid gap-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">Tableau de bord</h1>
          <span className="badge bg-critique text-white">
            {totalActives} alerte(s) active(s)
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-rose-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-rose-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Statut suivi</th>
                <th className="px-4 py-3">Alertes</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-50">
              {tries.map((p) => {
                const critique = p.actives > 0;
                return (
                  <tr key={p.id} className={critique ? "bg-red-50/60" : ""}>
                    <td className="px-4 py-3 font-semibold text-slate-700">{p.nom}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${
                          p.statut === "active"
                            ? "bg-green-100 text-ok"
                            : "bg-amber-100 text-attention"
                        }`}
                      >
                        {p.statut === "active" ? "Actif" : "Suspendu"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {critique ? (
                        <span className="badge bg-critique text-white">
                          {p.actives} active(s)
                        </span>
                      ) : p.acquittees > 0 ? (
                        <span className="badge bg-amber-100 text-attention">
                          {p.acquittees} acquittée(s)
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href="/apercu/pro/fiche"
                        className="text-sm font-medium text-brand hover:underline"
                      >
                        Ouvrir →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </CadrePro>
  );
}
