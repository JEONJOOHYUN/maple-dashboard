"use client";

import { useFormStatus } from "react-dom";

/** Submit button of the sign-out form: off while the request is on its way, so a second press does nothing. */
export function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-[10px] tile-edge bg-background px-3.5 text-[13px] font-semibold whitespace-nowrap text-foreground transition-[background-color,scale] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96] disabled:opacity-50"
    >
      로그아웃
    </button>
  );
}
