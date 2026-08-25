"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addWorker, type AddWorkerState } from "@/app/actions/workers";
import type { Worker } from "@/lib/supabase";

const initialState: AddWorkerState = {};

export function WorkerTabs({
  workers,
  selectedWorkerId,
}: {
  workers: Worker[];
  selectedWorkerId: number | undefined;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [state, formAction, isPending] = useActionState(addWorker, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.successAt) {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAdding(false);
    }
  }, [state.successAt]);

  function selectWorker(id: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("worker", String(id));
    router.push(`/settlement?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {workers.map((worker) => {
        const active = worker.id === selectedWorkerId;
        return (
          <button
            key={worker.id}
            type="button"
            onClick={() => selectWorker(worker.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-orange-500 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {worker.name}
          </button>
        );
      })}

      {adding ? (
        <form
          ref={formRef}
          action={formAction}
          className="flex items-center gap-1.5"
        >
          <input
            type="text"
            name="name"
            autoFocus
            placeholder="이름"
            className="w-24 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-orange-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            추가
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="rounded-full px-2 py-1.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            취소
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full border border-dashed border-slate-300 px-4 py-1.5 text-sm text-slate-500 hover:border-orange-400 hover:text-orange-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-orange-400 dark:hover:text-orange-400"
        >
          + 부주 추가
        </button>
      )}
      {state.error && (
        <p className="w-full text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </div>
  );
}
