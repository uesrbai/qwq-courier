"use client";

import { useActionState, useState } from "react";
import { Plus, Copy, Check, Power, Trash2, KeyRound, AlertTriangle, Eye } from "lucide-react";
import { useI18n } from "../i18n-provider";
import { CreateKeyDialog } from "./create-key-dialog";
import {
  deleteApiKeyAction,
  setApiKeyEnabledAction,
  setDefaultRateLimitAction,
  revealApiKeyAction,
  type RevealState,
} from "@/lib/actions/api-keys";
import { type MethodKey } from "@/lib/constants";

export type KeyDTO = {
  id: string;
  name: string;
  type: string;
  keyPrefix: string;
  scopeType: string;
  canReveal: boolean;
  scopes: string;
  allowedIps: string;
  rateLimitPerMin: number | null;
  allowIam: boolean;
  enabled: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};

function CopyButton({ text, label, copied }: { text: string; label: string; copied: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? copied : label}
    </button>
  );
}

export function ApiKeysView({
  baseUrl,
  keys,
  defaultRateLimit,
  canManageIam,
}: {
  baseUrl: string;
  keys: KeyDTO[];
  defaultRateLimit: number;
  canManageIam: boolean;
}) {
  const { dict } = useI18n();
  const t = dict.apiKeys;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const endpoint = `${baseUrl}/api/v1/send`;
  const curl = `curl -X POST ${endpoint} \\
  -H "Authorization: Bearer qwq_live_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"group":"hook-1","content":"Hello from qwq"}'`;

  return (
    <div className="space-y-6">
      {/* 新密钥横幅（只显示一次） */}
      {createdKey && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold">{t.newKeyTitle}</span>
          </div>
          <p className="mt-1 text-sm text-amber-700">{t.newKeyWarn}</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2 text-sm text-slate-800">
              {createdKey}
            </code>
            <CopyButton text={createdKey} label={t.copy} copied={t.copied} />
          </div>
          <button
            type="button"
            onClick={() => setCreatedKey(null)}
            className="mt-2 text-xs text-amber-600 underline"
          >
            {dict.common.cancel}
          </button>
        </div>
      )}

      {/* 接口地址 + 示例 */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">{t.baseUrlTitle}</h2>
        <p className="mt-1 text-sm text-slate-500">{t.baseUrlHint}</p>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            POST {endpoint}
          </code>
          <CopyButton text={endpoint} label={t.copy} copied={t.copied} />
        </div>
        <div className="mt-4">
          <div className="mb-1 text-xs font-medium text-slate-500">{t.example}</div>
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
            {curl}
          </pre>
        </div>
      </div>

      {/* 兼容接入：让别的推送系统按各自格式发进来 */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">{t.compatTitle}</h2>
        <p className="mt-1 text-sm text-slate-500">{t.compatHint}</p>
        <div className="mt-3 space-y-2.5">
          {[
            { name: "Server酱", url: `${baseUrl}/api/compat/serverchan/<密钥>~<分组编号>.send` },
            { name: "PushPlus", url: `${baseUrl}/api/compat/pushplus/send`, note: t.compatPushplusNote },
            { name: "Bark", url: `${baseUrl}/api/compat/bark/<密钥>~<分组编号>` },
            { name: "通用 / Generic", url: `${baseUrl}/api/compat/generic/<密钥>~<分组编号>` },
          ].map((row) => (
            <div key={row.name} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs font-medium text-slate-600">{row.name}</span>
              <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                {row.url}
              </code>
              <CopyButton text={row.url} label={t.copy} copied={t.copied} />
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{t.compatNote}</p>
      </div>

      {/* 默认限速设置 */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">{t.defaultRateLimit}</h2>
        <p className="mt-1 text-sm text-slate-500">{t.defaultRateLimitHint}</p>
        <form action={setDefaultRateLimitAction} className="mt-3 flex items-center gap-2">
          <input
            name="value"
            type="number"
            min={0}
            defaultValue={defaultRateLimit}
            className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
          <span className="text-sm text-slate-500">{t.perMin}</span>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {t.save}
          </button>
        </form>
      </div>

      {/* 密钥列表 */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">API {dict.dashboard.apiKeys}</h2>
            <p className="mt-0.5 text-xs text-slate-400">{t.permsLocked}</p>
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            {t.createKey}
          </button>
        </div>

        {keys.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <KeyRound className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm text-slate-400">{t.noKeys}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <KeyCard key={k.id} k={k} defaultRateLimit={defaultRateLimit} />
            ))}
          </div>
        )}
      </div>

      {dialogOpen && (
        <CreateKeyDialog
          open
          onClose={() => setDialogOpen(false)}
          onCreated={(key) => setCreatedKey(key)}
          defaultRateLimit={defaultRateLimit}
          canManageIam={canManageIam}
        />
      )}
    </div>
  );
}

function KeyCard({ k, defaultRateLimit }: { k: KeyDTO; defaultRateLimit: number }) {
  const { dict, locale } = useI18n();
  const t = dict.apiKeys;
  const [revealState, revealAction, revealing] = useActionState<RevealState, FormData>(
    revealApiKeyAction,
    undefined,
  );

  let scopes: string[] = [];
  let ips: string[] = [];
  try {
    scopes = JSON.parse(k.scopes || "[]");
  } catch {}
  try {
    ips = JSON.parse(k.allowedIps || "[]");
  } catch {}

  const scopeText =
    k.scopeType === "FULL"
      ? t.scopeAll
      : scopes.map((s) => dict.methods[s as MethodKey] ?? s).join("、");
  const isTest = k.type === "TEST";
  const rate = isTest ? `${k.rateLimitPerMin ?? defaultRateLimit} ${t.perMin}` : null;
  const ipText = k.type === "PRODUCTION" ? (ips.length ? ips.join(", ") : t.noIpLimit) : null;
  const lastUsed = k.lastUsedAt
    ? new Date(k.lastUsedAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")
    : t.never;

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 ${k.enabled ? "" : "opacity-70"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                isTest ? "bg-sky-50 text-sky-600" : "bg-emerald-50 text-emerald-600"
              }`}
            >
              {isTest ? dict.keyTypes.TEST : dict.keyTypes.PRODUCTION}
            </span>
            <span className="truncate text-sm font-semibold text-slate-900">{k.name}</span>
            {k.allowIam && (
              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-600">
                {t.allowIamBadge}
              </span>
            )}
            {!k.enabled && <span className="text-xs text-slate-400">· {t.disabledTag}</span>}
          </div>
          <code className="mt-1 block text-xs text-slate-400">{k.keyPrefix}</code>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>{t.scopeTypeLabel}: {scopeText}</span>
            {rate && <span>{t.rateLabel}: {rate}</span>}
            {ipText && <span>IP: {ipText}</span>}
            <span>{t.lastUsed}: {lastUsed}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <form action={setApiKeyEnabledAction}>
            <input type="hidden" name="id" value={k.id} />
            <input type="hidden" name="enabled" value={(!k.enabled).toString()} />
            <button
              type="submit"
              title={k.enabled ? t.disable : t.enable}
              className={`rounded-lg p-1.5 ${
                k.enabled ? "text-emerald-500 hover:bg-emerald-50" : "text-slate-300 hover:bg-slate-100"
              }`}
            >
              <Power className="h-4 w-4" />
            </button>
          </form>
          <form
            action={deleteApiKeyAction}
            onSubmit={(e) => {
              if (!confirm(t.confirmDelete)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={k.id} />
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

      {/* 查看密钥：受限权限可随时看；全权限只在创建时显示一次 */}
      <div className="mt-2 border-t border-slate-100 pt-2">
        {k.canReveal ? (
          <div className="flex flex-wrap items-center gap-2">
            <form action={revealAction}>
              <input type="hidden" name="id" value={k.id} />
              <button
                type="submit"
                disabled={revealing}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                <Eye className="h-3.5 w-3.5" />
                {t.viewKey}
              </button>
            </form>
            <span className="text-xs text-slate-400">{t.scopedViewHint}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400">{t.onceOnlyHint}</span>
        )}

        {revealState?.key && (
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800">
              {revealState.key}
            </code>
            <CopyButton text={revealState.key} label={t.copy} copied={t.copied} />
          </div>
        )}
        {revealState?.error && <p className="mt-1 text-xs text-red-600">{revealState.error}</p>}
      </div>
    </div>
  );
}
