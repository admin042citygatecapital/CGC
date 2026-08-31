import { Helmet } from "@dr.pogodin/react-helmet";
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCustomerAuth } from "@/lib/customerAuth";

type WorkflowStep = {
  key: string;
  label: string;
  status: "complete" | "current" | "waiting" | "blocked";
  href?: string;
};
type Bundle = {
  case: { id: string; caseType: string; status: string };
  intakePosition: number | null;
  evidence: Array<{ id: string; kind: string; reference: string }>;
  workflow: {
    status: string;
    queuePosition: number | null;
    currentStep: string;
    nextHref: string | null;
    canContinue: boolean;
    steps: WorkflowStep[];
  };
};
export default function OnboardingPage() {
  const { customer, logout } = useCustomerAuth();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [kind, setKind] = useState("identity");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/users/onboarding");
      const body = await r.json();
      if (r.ok) {
        setBundle(body);
        setMessage("");
      } else {
        setBundle(null);
        setMessage(body.error ?? "Registration progress is temporarily unavailable.");
      }
    } catch {
      setBundle(null);
      setMessage("Registration progress is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function addEvidence() {
    setBusy(true);
    setMessage("");
    const r = await fetch("/api/users/onboarding/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, referenceType: "provider", reference }),
    });
    const b = await r.json();
    setMessage(r.ok ? "Evidence reference added." : b.error);
    if (r.ok) {
      setReference("");
      await load();
    }
    setBusy(false);
  }
  async function submit() {
    setBusy(true);
    const r = await fetch("/api/users/onboarding/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const b = await r.json();
    setMessage(r.ok ? "Case submitted for compliance review." : b.error);
    await load();
    setBusy(false);
  }
  return (
    <main className="min-h-screen bg-background text-foreground p-6">
      <Helmet>
        <title>Registration Progress | City Gate Capital</title>
      </Helmet>
      <div className="max-w-2xl mx-auto space-y-6">
        {customer?.accessMode === 'full' ? (
          <Link to="/dashboard" className="inline-flex gap-2 text-sm text-foreground/50">
            <ArrowLeft size={16} /> Dashboard
          </Link>
        ) : (
          <button type="button" onClick={logout} className="inline-flex gap-2 text-sm text-foreground/50">
            <ArrowLeft size={16} /> Sign out
          </button>
        )}
        <div>
          <h1 className="text-3xl font-bold">Registration progress</h1>
          <p className="text-sm text-foreground/50 mt-2">
            Follow each required step. Progress is stored securely on the server
            and financial access remains unavailable until the controlled review
            is complete.
          </p>
        </div>
        {message && !bundle && !loading && (
          <div role="status" className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-5 text-sm text-amber-100">
            {message}
          </div>
        )}
        {loading ? (
          <Loader2 className="animate-spin" />
        ) : bundle ? (
          <>
            <section className="rounded-2xl border border-primary/20 bg-primary/[0.035] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">
                    Application workflow
                  </p>
                  <p className="mt-1 text-sm text-foreground/50">
                    Reference {bundle.case.id} · Current step:{" "}
                    {bundle.workflow.currentStep.replaceAll("_", " ")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {bundle.intakePosition && (
                    <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] text-foreground/55">
                      Intake #{bundle.intakePosition}
                    </span>
                  )}
                  {bundle.workflow.queuePosition && (
                    <span className="rounded-full border border-primary/20 px-3 py-1 text-xs text-primary">
                      Review queue #{bundle.workflow.queuePosition}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {bundle.workflow.steps.map((step, index) => (
                  <div
                    key={step.key}
                    className={`rounded-xl border p-3 ${step.status === "complete" ? "border-emerald-400/20 bg-emerald-400/[0.06]" : step.status === "current" ? "border-primary/30 bg-primary/[0.08]" : "border-white/8 bg-white/[0.02]"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-xs">
                        {step.status === "complete" ? "✓" : index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{step.label}</p>
                        <p className="text-[10px] uppercase text-foreground/40">
                          {step.status}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {bundle.workflow.canContinue && bundle.workflow.nextHref && (
                <Link
                  to={bundle.workflow.nextHref}
                  className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                >
                  Go to next step
                </Link>
              )}
            </section>
            <div className="rounded-2xl border border-white/10 p-5">
              <div className="flex justify-between">
                <span className="font-semibold">
                  {bundle.case.caseType} application
                </span>
                <span className="text-primary uppercase text-xs">
                  {bundle.case.status.replace("_", " ")}
                </span>
              </div>
            </div>
            {["draft", "needs_info"].includes(bundle.case.status) && (
              <div className="rounded-2xl border border-white/10 p-5 space-y-4">
                <label className="text-sm">
                  Evidence type
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                    className="block w-full mt-2 bg-white/5 border border-white/10 rounded-xl p-3"
                  >
                    <option value="identity">Identity</option>
                    <option value="address">Address</option>
                    <option value="selfie">Provider liveness check</option>
                    {bundle.case.caseType === "business" && (
                      <>
                        <option value="company">Company</option>
                        <option value="ownership">Beneficial ownership</option>
                        <option value="authority">Authorised user</option>
                      </>
                    )}
                  </select>
                </label>
                <label className="text-sm">
                  Approved-provider reference
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="block w-full mt-2 bg-white/5 border border-white/10 rounded-xl p-3"
                    placeholder="provider-case-reference"
                  />
                </label>
                <button
                  disabled={busy || reference.length < 3}
                  onClick={() => void addEvidence()}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground"
                >
                  Add reference
                </button>
              </div>
            )}
            <div className="space-y-2">
              {bundle.evidence.map((e) => (
                <div
                  key={e.id}
                  className="rounded-xl bg-white/5 p-3 flex gap-3"
                >
                  <ShieldCheck className="text-primary" />
                  <div>
                    <div className="font-semibold text-sm">{e.kind}</div>
                    <div className="text-xs text-foreground/45">
                      {e.reference}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {["draft", "needs_info"].includes(bundle.case.status) && (
              <button
                disabled={busy || bundle.evidence.length === 0}
                onClick={() => void submit()}
                className="w-full py-3 rounded-xl bg-emerald-500/20 text-emerald-300 font-semibold"
              >
                Submit application
              </button>
            )}
            {message && (
              <p className="rounded-xl border border-white/10 p-3 text-sm flex gap-2">
                <CheckCircle2 size={16} />
                {message}
              </p>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
