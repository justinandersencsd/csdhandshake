"use client";

import { useRef } from "react";

export function RoleSelect({
  userId,
  currentRole,
  roles,
  action,
}: {
  userId: string;
  currentRole: string;
  roles: string[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action} className="inline-flex">
      <input type="hidden" name="id" value={userId} />
      <select
        name="role"
        defaultValue={currentRole}
        onChange={() => formRef.current?.requestSubmit()}
        className="text-xs rounded border border-brand-border px-2 py-1 bg-white"
      >
        {roles.map((r) => (
          <option key={r} value={r}>
            {r.replace("_", " ")}
          </option>
        ))}
      </select>
    </form>
  );
}
