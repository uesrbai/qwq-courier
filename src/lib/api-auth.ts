import "server-only";
import { prisma } from "./db";
import { hashApiKey } from "./hash";
import { getDefaultTestRateLimit } from "./settings";

type ApiKeyRecord = Awaited<ReturnType<typeof prisma.apiKey.findUnique>>;

export type ApiAuthResult =
  | { ok: true; key: NonNullable<ApiKeyRecord> }
  | { ok: false; status: number; error: string };

export function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

export function extractBearer(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return null;
}

/** IAM 管理鉴权：密钥须开启 allowIam，且属主是 OWNER/ADMIN（非 IAM）。返回 parentId=属主id */
export async function authenticateIamKey(
  req: Request,
): Promise<{ ok: true; parentId: string } | { ok: false; status: number; error: string }> {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return { ok: false, status: auth.status, error: auth.error };
  const key = auth.key;
  if (!key.allowIam) {
    return { ok: false, status: 403, error: "该密钥无 IAM 管理权限 / key not allowed to manage IAM" };
  }
  const owner = await prisma.user.findUnique({ where: { id: key.userId } });
  if (!owner || owner.role === "IAM" || owner.status !== "ACTIVE") {
    return { ok: false, status: 403, error: "密钥属主无权管理 IAM / key owner cannot manage IAM" };
  }
  return { ok: true, parentId: owner.id };
}

/** 密钥是否允许该分发方式 */
export function keyAllowsMethod(key: NonNullable<ApiKeyRecord>, method: string): boolean {
  if (key.scopeType === "FULL") return true;
  try {
    const scopes = JSON.parse(key.scopes || "[]") as string[];
    return scopes.includes(method);
  } catch {
    return false;
  }
}

/** 校验请求头里的 Bearer API 密钥 */
export async function authenticateApiKey(req: Request): Promise<ApiAuthResult> {
  const raw = extractBearer(req);
  if (!raw) return { ok: false, status: 401, error: "缺少 API 密钥 / missing API key" };
  return authenticateRawKey(raw, req);
}

/** 按原始密钥字符串校验（供兼容端点用，密钥来自 URL/body 而非 Bearer 头） */
export async function authenticateRawKey(raw: string, req: Request): Promise<ApiAuthResult> {
  if (!raw) return { ok: false, status: 401, error: "缺少 API 密钥 / missing API key" };

  const key = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(raw) } });
  if (!key || !key.enabled) {
    return { ok: false, status: 401, error: "无效或已停用的密钥 / invalid or disabled key" };
  }

  // 生产密钥：可信 IP 校验
  if (key.type === "PRODUCTION") {
    let allowed: string[] = [];
    try {
      allowed = JSON.parse(key.allowedIps || "[]");
    } catch {
      allowed = [];
    }
    if (allowed.length > 0) {
      const ip = getClientIp(req);
      if (!ip || !allowed.includes(ip)) {
        return { ok: false, status: 403, error: `IP 不在白名单 / IP not allowed: ${ip ?? "unknown"}` };
      }
    }
  }

  // 测试密钥：慢速限制
  if (key.type === "TEST") {
    const limit = key.rateLimitPerMin ?? (await getDefaultTestRateLimit());
    if (limit && limit > 0) {
      const since = new Date(Date.now() - 60_000);
      const count = await prisma.callLog.count({
        where: { apiKeyId: key.id, createdAt: { gte: since } },
      });
      if (count >= limit) {
        return {
          ok: false,
          status: 429,
          error: `超出测试密钥限速（每分钟 ${limit} 次）/ rate limit exceeded (${limit}/min)`,
        };
      }
    }
  }

  return { ok: true, key };
}
