import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useActionState, useTransition } from "react";
import { Plus, X, ArrowRight, Loader2 } from "lucide-react";
import { create } from "zustand";
import { addAccount } from "@/functions/accounts";
import { guardOnboarding } from "@/functions/guards";

export const Route = createFileRoute("/onboarding")({
  loader: () => guardOnboarding(),
  component: OnboardingPage,
});

// ---- Zustand store ----

type OnboardingStore = {
  handles: string[];
  addHandle: (handle: string) => void;
  removeHandle: (handle: string) => void;
};

const useOnboarding = create<OnboardingStore>((set) => ({
  handles: [],
  addHandle: (handle) =>
    set((s) => ({
      handles: s.handles.includes(handle) ? s.handles : [...s.handles, handle],
    })),
  removeHandle: (handle) =>
    set((s) => ({ handles: s.handles.filter((h) => h !== handle) })),
}));

// ---- Components ----

function HandleTag({ handle }: { handle: string }) {
  const removeHandle = useOnboarding((s) => s.removeHandle);

  return (
    <div className="flex items-center justify-between p-3 bg-base-100 rounded-box border border-base-300 shadow-sm animate-[fadeUp_0.3s_ease_both]">
      <span className="text-sm font-semibold text-base-content">{handle}</span>
      <button
        type="button"
        onClick={() => removeHandle(handle)}
        className="btn btn-ghost btn-circle btn-sm focus:outline-none text-base-content/30 hover:text-base-content/60 hover:bg-transparent"
        aria-label={`Eliminar ${handle}`}
      >
        <X size={13} />
      </button>
    </div>
  );
}

function AddHandleForm() {
  const { handles, addHandle } = useOnboarding();

  const [error, action, pending] = useActionState(
    async (_: string | undefined, formData: FormData) => {
      const raw = (formData.get("handle") as string).trim().replace(/^@/, "");
      if (!raw) return "Ingresa un handle válido";
      if (handles.length >= 5) return "Máximo 5 cuentas";
      if (handles.includes(`@${raw}`)) return "Ya la agregaste";
      addHandle(`@${raw}`);
    },
    undefined,
  );

  if (handles.length >= 5) return null;

  return (
    <div className="space-y-2">
      <form action={action} className="flex gap-2">
        <label htmlFor="handle" className="sr-only">Handle de X</label>
        <input
          id="handle"
          name="handle"
          type="text"
          placeholder="@naval"
          className="input input-bordered w-full bg-white border-base-300"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn btn-neutral btn-square focus:outline-none"
          style={{ borderRadius: 14 }}
          aria-label="Agregar cuenta"
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
        </button>
      </form>
      {error && <p className="text-error text-xs pl-1">{error}</p>}
    </div>
  );
}

function StepAccounts() {
  const handles = useOnboarding((s) => s.handles);
  const navigate = useNavigate();
  const [saving, startTransition] = useTransition();

  function handleFinish() {
    if (handles.length === 0) return;
    startTransition(async () => {
      for (const handle of handles) {
        await addAccount({ data: { handle } });
      }
      navigate({ to: "/feed" });
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold text-base-content tracking-tight">
          ¿A quién quieres seguir?
        </h1>
        <p className="text-sm text-base-content/50 leading-relaxed">
          Agrega hasta 5 cuentas de X — competidores, referentes, o cualquier cuenta que te importe.
        </p>
      </div>

      {handles.length > 0 && (
        <div className="space-y-2">
          {handles.map((h) => <HandleTag key={h} handle={h} />)}
        </div>
      )}

      <AddHandleForm />

      <div className="text-center text-xs text-base-content/30">
        {handles.length}/5 cuentas agregadas
      </div>

      <button
        type="button"
        disabled={handles.length === 0 || saving}
        onClick={handleFinish}
        className="btn btn-neutral w-full"
      >
        {saving ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <>Ir a mi feed <ArrowRight size={15} /></>
        )}
      </button>
    </div>
  );
}

// ---- Page ----

function OnboardingPage() {
  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-base-100 to-base-200 flex items-center justify-center px-4">
        <div className="w-full max-w-sm animate-[fadeUp_0.5s_ease_both]">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-extrabold text-base-content tracking-tight">
              TweetSip ☕
            </h2>
          </div>
          <StepAccounts />
        </div>
      </div>
    </>
  );
}
