import type { StepState } from "@/lib/pipeline";

interface ProgressStepperProps {
  steps: StepState[];
}

export function ProgressStepper({ steps }: ProgressStepperProps) {
  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-[600px] space-y-6">
        <h1 className="text-2xl font-medium tracking-tight">
          Building your video...
        </h1>

        <div className="space-y-3" role="status" aria-live="polite">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center gap-3">
              <StepIcon status={step.status} />
              <span
                className={`text-sm ${
                  step.status === "pending"
                    ? "text-neutral-400"
                    : "text-neutral-900"
                }`}
              >
                {step.label}
                {step.status === "active" && "..."}
              </span>
              {step.status === "complete" && step.elapsed !== undefined && (
                <span className="text-xs text-neutral-400 ml-auto">
                  {step.elapsed.toFixed(1)}s
                </span>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-neutral-400">
          Usually takes about 90 seconds.
        </p>
      </div>
    </main>
  );
}

function StepIcon({ status }: { status: StepState["status"] }) {
  if (status === "complete") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-white text-xs">
        ✓
      </span>
    );
  }

  if (status === "active") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-neutral-900 animate-pulse" />
    );
  }

  if (status === "failed") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs">
        ✕
      </span>
    );
  }

  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-neutral-200" />
  );
}
