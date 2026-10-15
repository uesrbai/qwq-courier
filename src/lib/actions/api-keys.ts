"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logOperation } from "@/lib/audit";
import { canAccessFeature } from "@/lib/permissions";
import { generateApiKey, encryptSecret, decryptSecret } from "@/lib/hash";
import { setSetting } from "@/lib/settings";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { METHOD_KEYS, type MethodKey } from "@/lib/constants";

export type KeyFormState = { ok?: boolean; error?: string; plainKey?: string } | undefined;

function parseIps(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createApiKeyAction(_prev: KeyFormState, fd: FormData): Promise<KeyFormState> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).apiKeys;
  if (!canAccessFeature(user, "apiKeys")) return { error: t.errNoPermission };

  const name = String(fd.get("name") ?? "").trim();
  const type = String(fd.get("type") ?? "TEST") === "PRODUCTION" ? "PRODUCTION" : "TEST";
  const scopeType = String(fd.get("scopeType") ?? "FULL") === "SCOPED" ? "SCOPED" : "FULL";
  const scopes = fd
    .getAll("scopes")
    .map(String)
    .filter((s) => METHOD_KEYS.includes(s as MethodKey));
  const allowedIps = parseIps(String(fd.get("allowedIps") ?? ""));
  const rateRaw = String(fd.get("rateLimitPerMin") ?? "").trim();
  const rateLimitPerMin =
    type === "TEST" && rateRaw ? Math.max(1, Number(rateRaw) || 0) || null : null;
  // 高权限：允许用该密钥通过 API 管理 IAM 子账号，仅 OWNER/ADMIN 可开
  const allowIam = user.role !== "IAM" && String(fd.get("allowIam") ?? "") === "on";

  if (!name) return { error: t.errName };
  if (scopeType === "SCOPED" && scopes.length === 0) return { error: t.errScope };

  const gen = generateApiKey(type);
  await prisma.apiKey.create({
    data: {
      userId: user.id,
      name,
      type,
      keyPrefix: gen.prefix,
      keyHash: gen.hash,
      // 受限权限密钥加密留存，便于以后重复查看；全权限密钥只存哈希，仅创建时显示一次
      keyEnc: scopeType === "SCOPED" ? encryptSecret(gen.raw) : null,
      scopeType,
      scopes: JSON.stringify(scopes),
      allowedIps: JSON.stringify(allowedIps),
      rateLimitPerMin,
      allowIam,
    },
  });
  await logOperation(user, "apikey.create", `${name} [${type}]`);
  revalidatePath("/api-keys");
  return { ok: true, plainKey: gen.raw };
}

export type RevealState = { key?: string; error?: string } | undefined;

/** 查看受限权限密钥的完整明文（全权限密钥不支持） */
export async function revealApiKeyAction(_prev: RevealState, fd: FormData): Promise<RevealState> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).apiKeys;
  if (!canAccessFeature(user, "apiKeys")) return { error: t.errNoPermission };

  const id = String(fd.get("id") ?? "");
  const k = await prisma.apiKey.findUnique({ where: { id } });
  if (!k || k.scopeType !== "SCOPED" || !k.keyEnc) return { error: t.errCannotReveal };

  const plain = decryptSecret(k.keyEnc);
  if (!plain) return { error: t.errCannotReveal };

  await logOperation(user, "apikey.reveal", k.name);
  return { key: plain };
}

export async function deleteApiKeyAction(fd: FormData) {
  const user = await requireUser();
  if (!canAccessFeature(user, "apiKeys")) return;
  const id = String(fd.get("id") ?? "");
  if (id) {
    const k = await prisma.apiKey.findUnique({ where: { id } });
    await prisma.apiKey.delete({ where: { id } });
    await logOperation(user, "apikey.delete", k?.name ?? id);
    revalidatePath("/api-keys");
  }
}

export async function setApiKeyEnabledAction(fd: FormData) {
  const user = await requireUser();
  if (!canAccessFeature(user, "apiKeys")) return;
  const id = String(fd.get("id") ?? "");
  const enabled = String(fd.get("enabled") ?? "") === "true";
  if (id) {
    const k = await prisma.apiKey.update({ where: { id }, data: { enabled } });
    await logOperation(user, enabled ? "apikey.enable" : "apikey.disable", k.name);
    revalidatePath("/api-keys");
  }
}

export async function setDefaultRateLimitAction(fd: FormData) {
  const user = await requireUser();
  if (!canAccessFeature(user, "apiKeys")) return;
  const value = Math.max(0, Number(String(fd.get("value") ?? "").trim()) || 0);
  await setSetting("default_test_rate_limit", value);
  await logOperation(user, "setting.update", `default_test_rate_limit = ${value}`);
  revalidatePath("/api-keys");
}
