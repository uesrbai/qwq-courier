import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/hash";
import { IAM_FEATURES } from "@/lib/permissions";
import { METHOD_KEYS, type MethodKey } from "@/lib/constants";

// IAM 子账号的核心增删改查（纯逻辑，不做鉴权——调用方负责鉴权）。
// 平台(qwq)是账号唯一权威；qwq-sso 仅作为可选的登录绑定(预绑 ssoSubject)。

export type IamView = {
  id: string;
  username: string;
  displayName: string | null;
  email: string;
  status: string;
  enabled: boolean;
  features: string[];
  methods: string[];
  ssoBound: boolean;
  ssoSubject: string | null;
  createdAt: string;
};

export type IamResult =
  | { ok: true; user: IamView; generatedPassword?: string }
  | { ok: false; status: number; error: string };

type UserRow = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;

function view(u: UserRow): IamView {
  let features: string[] = [];
  let methods: string[] = [];
  try {
    const p = JSON.parse(u.permissions || "{}");
    features = Array.isArray(p.features) ? p.features.map(String) : [];
    methods = Array.isArray(p.methods) ? p.methods.map(String) : [];
  } catch {
    /* ignore */
  }
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    email: u.email,
    status: u.status,
    enabled: u.status === "ACTIVE",
    features,
    methods,
    ssoBound: !!u.ssoSubject,
    ssoSubject: u.ssoSubject ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

function cleanFeatures(arr: unknown): string[] {
  const list = IAM_FEATURES as readonly string[];
  return Array.isArray(arr) ? arr.map(String).filter((f) => list.includes(f)) : [];
}
function cleanMethods(arr: unknown): string[] {
  return Array.isArray(arr)
    ? arr.map(String).filter((m) => METHOD_KEYS.includes(m as MethodKey))
    : [];
}

/** 校验/占用某个 qwq-sso 身份：返回错误信息或 null */
async function ssoConflict(ssoSubject: string, exceptUserId?: string): Promise<string | null> {
  const existing = await prisma.user.findFirst({
    where: { ssoProvider: "qwq-sso", ssoSubject },
  });
  if (existing && existing.id !== exceptUserId) {
    return "该 qwq-sso 身份已被其他账号绑定 / qwq-sso identity already bound";
  }
  return null;
}

export type CreateIamInput = {
  username: string;
  password?: string; // 留空则自动生成并在返回里给出一次
  email?: string;
  displayName?: string;
  features?: unknown;
  methods?: unknown;
  ssoSubject?: string; // 预绑 qwq-sso 身份标识(sub)
};

export async function createIamUser(parentId: string, input: CreateIamInput): Promise<IamResult> {
  const username = (input.username || "").trim();
  if (username.length < 2) return { ok: false, status: 400, error: "用户名至少 2 个字符 / username too short" };

  let generatedPassword: string | undefined;
  let password = input.password ?? "";
  if (!password) {
    generatedPassword = randomBytes(9).toString("base64url"); // 12 位随机密码
    password = generatedPassword;
  }
  if (password.length < 6) return { ok: false, status: 400, error: "密码至少 6 位 / password too short" };

  if (await prisma.user.findUnique({ where: { username } })) {
    return { ok: false, status: 409, error: "用户名已存在 / username exists" };
  }

  let email = (input.email || "").trim() || `iam_${username}@local`;
  if (await prisma.user.findUnique({ where: { email } })) {
    email = `iam_${username}_${randomBytes(3).toString("hex")}@local`;
  }

  const ssoSubject = (input.ssoSubject || "").trim();
  if (ssoSubject) {
    const conflict = await ssoConflict(ssoSubject);
    if (conflict) return { ok: false, status: 409, error: conflict };
  }

  const u = await prisma.user.create({
    data: {
      email,
      username,
      displayName: (input.displayName || "").trim() || username,
      passwordHash: hashPassword(password),
      role: "IAM",
      parentId,
      permissions: JSON.stringify({ features: cleanFeatures(input.features), methods: cleanMethods(input.methods) }),
      ...(ssoSubject ? { ssoProvider: "qwq-sso", ssoSubject } : {}),
    },
  });
  return { ok: true, user: view(u), generatedPassword };
}

/** 确认目标是该 parent 的 IAM 子账号 */
async function ownSub(parentId: string, id: string): Promise<UserRow | null> {
  const target = await prisma.user.findUnique({ where: { id } });
  return target && target.parentId === parentId && target.role === "IAM" ? target : null;
}

export type UpdateIamPatch = {
  displayName?: string;
  password?: string;
  features?: unknown;
  methods?: unknown;
  enabled?: boolean;
  ssoSubject?: string | null; // "" 或 null 解绑；字符串则(重新)绑定
};

export async function updateIamUser(
  parentId: string,
  id: string,
  patch: UpdateIamPatch,
): Promise<IamResult> {
  const target = await ownSub(parentId, id);
  if (!target) return { ok: false, status: 404, error: "子账号不存在 / sub-account not found" };

  const data: Record<string, unknown> = {};
  if (typeof patch.displayName === "string" && patch.displayName.trim()) {
    data.displayName = patch.displayName.trim();
  }
  if (typeof patch.password === "string" && patch.password) {
    if (patch.password.length < 6) return { ok: false, status: 400, error: "密码至少 6 位 / password too short" };
    data.passwordHash = hashPassword(patch.password);
  }
  if (patch.features !== undefined || patch.methods !== undefined) {
    data.permissions = JSON.stringify({
      features: cleanFeatures(patch.features),
      methods: cleanMethods(patch.methods),
    });
  }
  if (typeof patch.enabled === "boolean") {
    data.status = patch.enabled ? "ACTIVE" : "DISABLED";
  }
  if (patch.ssoSubject !== undefined) {
    const sub = (patch.ssoSubject || "").trim();
    if (sub) {
      const conflict = await ssoConflict(sub, target.id);
      if (conflict) return { ok: false, status: 409, error: conflict };
      data.ssoProvider = "qwq-sso";
      data.ssoSubject = sub;
    } else {
      data.ssoProvider = null;
      data.ssoSubject = null;
    }
  }

  const u = await prisma.user.update({ where: { id }, data });
  return { ok: true, user: view(u) };
}

export async function deleteIamUser(parentId: string, id: string): Promise<IamResult> {
  const target = await ownSub(parentId, id);
  if (!target) return { ok: false, status: 404, error: "子账号不存在 / sub-account not found" };
  await prisma.user.delete({ where: { id } });
  return { ok: true, user: view(target) };
}

export async function getIamUser(parentId: string, id: string): Promise<IamResult> {
  const target = await ownSub(parentId, id);
  if (!target) return { ok: false, status: 404, error: "子账号不存在 / sub-account not found" };
  return { ok: true, user: view(target) };
}

export async function listIamUsers(parentId: string): Promise<IamView[]> {
  const rows = await prisma.user.findMany({
    where: { parentId, role: "IAM" },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(view);
}
