"use client";

import { useActionState, useEffect, useState } from "react";
import { createApiKeyAction, type KeyFormState } from "@/lib/actions/api-keys";
import { useI18n } from "../i18n-provider";
import { Modal } from "../ui/modal";
import { Field, inputCls } from "../ui/field";
import { useFormValues } from "../ui/use-form-values";
import { METHOD_KEYS, type MethodKey } from "@/lib/constants";

function RadioCard({
  checked,
  onClick,
  label,
  hint,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm transition ${
        checked
          ? "border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500"
          : "border-slate-300 text-slate-600 hover:bg-slate-50"
      }`}
    >
      <div className="font-medium">{label}</div>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </button>
  );
}

export function CreateKeyDialog({
  open,
  onClose,
  onCreated,
  defaultRateLimit,
  canManageIam,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (key: string) => void;
  defaultRateLimit: number;
  canManageIam?: boolean;
}) {
  const { dict } = useI18n();
  const t = dict.apiKeys;
  const [type, setType] = useState<"TEST" | "PRODUCTION">("TEST");
  const [scopeType, setScopeType] = useState<"FULL" | "SCOPED">("FULL");
  const [scopes, setScopes] = useState<MethodKey[]>([]);
  const { bind } = useFormValues({ name: "", allowedIps: "", rateLimitPerMin: "" });

  const [state, action, pending] = useActionState<KeyFormState, FormData>(
    createApiKeyAction,
    undefined,
  );

  useEffect(() => {
    if (state?.ok && state.plainKey) {
      onCreated(state.plainKey);
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.ok, state?.plainKey]);

  function toggleScope(m: MethodKey) {
    setScopes((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  return (
    <Modal open={open} onClose={onClose} title={t.createKey}>
      <form action={action} className="space-y-4">
        <Field label={t.keyName}>
          <input name="name" {...bind("name")} placeholder={t.keyNamePlaceholder} className={inputCls} />
        </Field>

        <Field label={t.type}>
          <div className="flex gap-2">
            <RadioCard checked={type === "TEST"} onClick={() => setType("TEST")} label={dict.keyTypes.TEST} />
            <RadioCard
              checked={type === "PRODUCTION"}
              onClick={() => setType("PRODUCTION")}
              label={dict.keyTypes.PRODUCTION}
            />
          </div>
          <input type="hidden" name="type" value={type} />
        </Field>

        <Field label={t.scopeTypeLabel}>
          <div className="flex gap-2">
            <RadioCard checked={scopeType === "FULL"} onClick={() => setScopeType("FULL")} label={t.scopeFull} />
            <RadioCard
              checked={scopeType === "SCOPED"}
              onClick={() => setScopeType("SCOPED")}
              label={t.scopeScoped}
            />
          </div>
          <input type="hidden" name="scopeType" value={scopeType} />
        </Field>

        {scopeType === "SCOPED" && (
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3">
            {METHOD_KEYS.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="scopes"
                  value={m}
                  checked={scopes.includes(m)}
                  onChange={() => toggleScope(m)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {dict.methods[m]}
              </label>
            ))}
          </div>
        )}

        {type === "PRODUCTION" && (
          <Field label={t.allowedIps} help={t.allowedIpsHint}>
            <textarea name="allowedIps" rows={2} {...bind("allowedIps")} placeholder="1.2.3.4" className={inputCls} />
          </Field>
        )}

        {type === "TEST" && (
          <Field label={t.rateLimit} help={t.rateLimitHint}>
            <input
              name="rateLimitPerMin"
              type="number"
              min={1}
              {...bind("rateLimitPerMin")}
              placeholder={String(defaultRateLimit)}
              className={inputCls}
            />
          </Field>
        )}

        {canManageIam && (
          <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <input type="checkbox" name="allowIam" className="mt-0.5 h-4 w-4 rounded border-amber-300" />
            <span>
              <span className="font-medium">{t.allowIam}</span>
              <span className="mt-0.5 block text-xs text-amber-600">{t.allowIamHint}</span>
            </span>
          </label>
        )}

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {pending ? t.creating : t.create}
          </button>
        </div>
      </form>
    </Modal>
  );
}
