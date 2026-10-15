"use client";

import { useActionState, useEffect, useState } from "react";
import { Power, Trash2, UserPlus, KeyRound, Pencil } from "lucide-react";
import { useI18n } from "../i18n-provider";
import { Modal } from "../ui/modal";
import { Field, inputCls } from "../ui/field";
import { useFormValues } from "../ui/use-form-values";
import { IAM_FEATURES, parsePermissions } from "@/lib/permissions";
import { METHOD_KEYS } from "@/lib/constants";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  createIamAction,
  updateIamAction,
  setUserEnabledAction,
  deleteIamAction,
  resetIamPasswordAction,
  type FormState,
} from "@/lib/actions/users";

export type IamDTO = {
  id: string;
  username: string;
  displayName: string | null;
  status: string;
  permissions: string;
};

function permsSummary(dict: Dictionary, permissions: string): string {
  const p = parsePermissions(permissions);
  if (p.features.length === 0) return dict.settings.permsNone;
  return p.features.map((f) => dict.nav[f as keyof Dictionary["nav"]] ?? f).join("、");
}

/** 功能 / 分发方式 勾选区（新建与编辑共用） */
function PermissionFields({
  features,
  methods,
  setFeatures,
  setMethods,
}: {
  features: string[];
  methods: string[];
  setFeatures: (v: string[]) => void;
  setMethods: (v: string[]) => void;
}) {
  const { dict } = useI18n();
  const t = dict.settings;
  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <>
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{t.permsHint}</p>

      <Field label={t.features}>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3">
          {IAM_FEATURES.map((f) => (
            <label key={f} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="features"
                value={f}
                checked={features.includes(f)}
                onChange={() => toggle(features, setFeatures, f)}
                className="h-4 w-4 rounded border-slate-300"
              />
              {dict.nav[f]}
            </label>
          ))}
        </div>
      </Field>

      <Field label={t.methods}>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3">
          {METHOD_KEYS.map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="methods"
                value={m}
                checked={methods.includes(m)}
                onChange={() => toggle(methods, setMethods, m)}
                className="h-4 w-4 rounded border-slate-300"
              />
              {dict.methods[m]}
            </label>
          ))}
        </div>
      </Field>
    </>
  );
}

export function IamManager({ accounts }: { accounts: IamDTO[] }) {
  const { dict } = useI18n();
  const t = dict.settings;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IamDTO | null>(null);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{t.iamTitle}</h2>
          <p className="mt-1 text-sm text-slate-500">{t.iamHint}</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <UserPlus className="h-4 w-4" />
          {t.addIam}
        </button>
      </div>

      {accounts.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">{t.noIam}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {accounts.map((a) => (
            <IamCard key={a.id} a={a} onEdit={() => setEditing(a)} />
          ))}
        </div>
      )}

      {open && <CreateIamDialog onClose={() => setOpen(false)} />}
      {editing && <EditIamDialog account={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function IamCard({ a, onEdit }: { a: IamDTO; onEdit: () => void }) {
  const { dict } = useI18n();
  const t = dict.settings;
  const active = a.status === "ACTIVE";

  return (
    <div className={`rounded-lg border border-slate-200 p-3 ${active ? "" : "opacity-70"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {dict.roles.IAM}
            </span>
            <span className="truncate text-sm font-semibold text-slate-900">
              {a.displayName ?? a.username}
            </span>
            {!active && <span className="text-xs text-slate-400">· {t.disabledTag}</span>}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {t.features}: {permsSummary(dict, a.permissions)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onEdit}
            title={t.editIam}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <form action={setUserEnabledAction}>
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="enabled" value={(!active).toString()} />
            <button
              type="submit"
              title={active ? t.disable : t.enable}
              className={`rounded-lg p-1.5 ${
                active ? "text-emerald-500 hover:bg-emerald-50" : "text-slate-300 hover:bg-slate-100"
              }`}
            >
              <Power className="h-4 w-4" />
            </button>
          </form>
          <form
            action={deleteIamAction}
            onSubmit={(e) => {
              if (!confirm(t.confirmDeleteIam)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={a.id} />
            <button
              type="submit"
              title={t.delete}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      <form action={resetIamPasswordAction} className="mt-2 flex items-center gap-2">
        <input type="hidden" name="id" value={a.id} />
        <input
          name="password"
          type="password"
          minLength={6}
          required
          placeholder={t.resetPlaceholder}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <KeyRound className="h-3.5 w-3.5" />
          {t.reset}
        </button>
      </form>
    </div>
  );
}

function CreateIamDialog({ onClose }: { onClose: () => void }) {
  const { dict } = useI18n();
  const t = dict.settings;
  const { bind } = useFormValues({ username: "", email: "", password: "", ssoSubject: "" });
  const [features, setFeatures] = useState<string[]>([]);
  const [methods, setMethods] = useState<string[]>([]);
  const [state, action, pending] = useActionState<FormState, FormData>(createIamAction, undefined);

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state?.ok, onClose]);

  return (
    <Modal open onClose={onClose} title={t.addIam}>
      <form action={action} className="space-y-4">
        <Field label={t.username}>
          <input name="username" {...bind("username")} placeholder={t.usernamePlaceholder} className={inputCls} />
        </Field>
        <Field label={t.email}>
          <input name="email" type="email" {...bind("email")} placeholder="you@example.com" className={inputCls} />
        </Field>
        <Field label={t.password}>
          <input
            name="password"
            type="password"
            {...bind("password")}
            placeholder={t.passwordPlaceholder}
            className={inputCls}
          />
        </Field>
        <Field label={t.ssoBindOptional} help={t.ssoBindOptionalHint}>
          <input name="ssoSubject" {...bind("ssoSubject")} placeholder="qwq-sso sub" className={inputCls} />
        </Field>

        <PermissionFields
          features={features}
          methods={methods}
          setFeatures={setFeatures}
          setMethods={setMethods}
        />

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
            {pending ? t.saving : t.create}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditIamDialog({ account, onClose }: { account: IamDTO; onClose: () => void }) {
  const { dict } = useI18n();
  const t = dict.settings;
  const initial = parsePermissions(account.permissions);
  const [features, setFeatures] = useState<string[]>(initial.features);
  const [methods, setMethods] = useState<string[]>(initial.methods);
  const [state, action, pending] = useActionState<FormState, FormData>(updateIamAction, undefined);

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state?.ok, onClose]);

  return (
    <Modal open onClose={onClose} title={`${t.editIam} · ${account.displayName ?? account.username}`}>
      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={account.id} />

        <PermissionFields
          features={features}
          methods={methods}
          setFeatures={setFeatures}
          setMethods={setMethods}
        />

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
            {pending ? t.saving : t.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}
