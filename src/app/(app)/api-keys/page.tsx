import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { requireFeature } from "@/lib/auth";
import { getDefaultTestRateLimit } from "@/lib/settings";
import { PageHeader } from "@/components/page-header";
import { ApiKeysView, type KeyDTO } from "@/components/api-keys/api-keys-view";

export default async function ApiKeysPage() {
  const user = await requireFeature("apiKeys");
  const { dict } = await getI18n();
  const p = dict.pages.apiKeys;
  const canManageIam = user.role !== "IAM";

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  const [rawKeys, defaultRateLimit] = await Promise.all([
    prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } }),
    getDefaultTestRateLimit(),
  ]);

  const keys: KeyDTO[] = rawKeys.map((k) => ({
    id: k.id,
    name: k.name,
    type: k.type,
    keyPrefix: k.keyPrefix,
    scopeType: k.scopeType,
    canReveal: k.scopeType === "SCOPED" && !!k.keyEnc,
    scopes: k.scopes,
    allowedIps: k.allowedIps,
    rateLimitPerMin: k.rateLimitPerMin,
    allowIam: k.allowIam,
    enabled: k.enabled,
    lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
    createdAt: k.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader title={p.title} description={p.desc} />
      <ApiKeysView
        baseUrl={baseUrl}
        keys={keys}
        defaultRateLimit={defaultRateLimit}
        canManageIam={canManageIam}
      />
    </>
  );
}
