"use client";

import { useActionState, useEffect, useRef } from "react";
import { addWorker, type AddWorkerState } from "@/app/actions/workers";

const initialState: AddWorkerState = {};

export function AdminAddWorkerForm() {
  const [state, formAction, isPending] = useActionState(addWorker, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.successAt) {
      formRef.current?.reset();
    }
  }, [state.successAt]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
        새 부주 이름
        <input
          type="text"
          name="name"
          required
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-orange-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
      >
        {isPending ? "추가 중..." : "추가"}
      </button>
      {state.error && (
        <p className="w-full text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
