"use client";

import { useFormStatus } from "react-dom";
import { ACCOUNT_BUTTON } from "@/components/auth/account-button";
import { cn } from "@/lib/utils";

/** Submit button of the sign-out form: off while the request is on its way, so a second press does nothing. */
export function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(ACCOUNT_BUTTON, "disabled:opacity-50")}
    >
      로그아웃
    </button>
  );
}
