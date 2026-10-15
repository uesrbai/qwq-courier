"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logOperation } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/hash";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { IAM_FEATURES, canAccessFeature } from "@/lib/permissions";
import { METHOD_KEYS, type MethodKey } from "@/lib/constants";
import { createIamUser } from "@/lib/iam-core";

export type FormState = { ok?: boolean; error?: string } | undefined;

// ---------- 修改自己的密码 ----------
export async function changePasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).settings;

  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  if (next.length < 6) return { error: t.errPwdShort };
  if (next !== confirm) return { error: t.errPwdMismatch };
  if (user.passwordHash && !verifyPassword(current, user.passwordHash)) {
    return { error: t.errPwdWrong };
  }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(next) } });
  await logOperation(user, "password.change", user.displayName ?? user.username);
  return { ok: true };
}

// ---------- 创建 IAM 子账号（可预绑 qwq-sso）----------
export async function createIamAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).settings;
  if (user.role === "IAM") return { error: t.errNoPermission };

  const r = await createIamUser(user.id, {
    username: String(fd.get("username") ?? ""),
    password: String(fd.get("password") ?? ""),
    email: String(fd.get("email") ?? ""),
    features: fd.getAll("features").map(String),
    methods: fd.getAll("methods").map(String),
    ssoSubject: String(fd.get("ssoSubject") ?? ""),
  });
  if (!r.ok) return { error: r.error };
  await logOperation(user, "iam.create", r.user.username);
  revalidatePath("/settings");
  return { ok: true };
}

// ---------- 解绑 qwq-sso ----------
export async function unbindSsoAction() {
  const user = await requireUser();
  // 没有本地密码的话解绑会把自己锁在外面，禁止
  if (!user.passwordHash) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { ssoProvider: null, ssoSubject: null },
  });
  await logOperation(user, "iam.update", `${user.username} 解绑 qwq-sso`);
  revalidatePath("/settings");
}

// ---------- 管理员：解绑任意账号的 qwq-sso（清理影子/错绑账号）----------
export async function adminUnbindSsoAction(fd: FormData) {
  const user = await requireUser();
  // 仅系统设置权限（OWNER/ADMIN）可操作
  if (!canAccessFeature(user, "system")) return;
  const id = String(fd.get("id") ?? "");
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || !target.ssoSubject) return;
  await prisma.user.update({
    where: { id },
    data: { ssoProvider: null, ssoSubject: null },
  });
  await logOperation(user, "iam.update", `${target.username} 解绑 qwq-sso（管理员）`);
  revalidatePath("/system");
}

// ---------- 管理员：删除影子账号（无密码、只靠 SSO 的空账号）----------
export async function adminDeleteSsoUserAction(fd: FormData) {
  const user = await requireUser();
  if (!canAccessFeature(user, "system")) return;
  const id = String(fd.get("id") ?? "");
  if (id === user.id) return; // 不能删自己
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return;
  // 只允许删「靠 SSO 建出来、且不是拥有者」的账号，避免误删真人账号
  if (target.role === "OWNER") return;
  await prisma.user.delete({ where: { id } });
  await logOperation(user, "iam.delete", `${target.username}（SSO 影子账号）`);
  revalidatePath("/system");
}

// ---------- 修改子账号权限 ----------
export async function updateIamAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).settings;
  if (user.role === "IAM") return { error: t.errNoPermission };

  const id = String(fd.get("id") ?? "");
  const featureList = IAM_FEATURES as readonly string[];
  const features = fd.getAll("features").map(String).filter((f) => featureList.includes(f));
  const methods = fd
    .getAll("methods")
    .map(String)
    .filter((m) => METHOD_KEYS.includes(m as MethodKey));

  const target = await ownSubAccount(user.id, id);
  if (!target) return { error: t.errNoPermission };

  await prisma.user.update({
    where: { id },
    data: { permissions: JSON.stringify({ features, methods }) },
  });
  await logOperation(user, "iam.update", target.username);
  revalidatePath("/settings");
  return { ok: true };
}

// ---------- 子账号：启停 / 删除 / 重置密码 ----------
async function ownSubAccount(parentId: string, id: string) {
  const target = await prisma.user.findUnique({ where: { id } });
  return target && target.parentId === parentId && target.role === "IAM" ? target : null;
}

export async function setUserEnabledAction(fd: FormData) {
  const user = await requireUser();
  if (user.role === "IAM") return;
  const id = String(fd.get("id") ?? "");
  const enabled = String(fd.get("enabled") ?? "") === "true";
  const target = await ownSubAccount(user.id, id);
  if (target) {
    await prisma.user.update({ where: { id }, data: { status: enabled ? "ACTIVE" : "DISABLED" } });
    await logOperation(user, enabled ? "iam.enable" : "iam.disable", target.username);
    revalidatePath("/settings");
  }
}

export async function deleteIamAction(fd: FormData) {
  const user = await requireUser();
  if (user.role === "IAM") return;
  const id = String(fd.get("id") ?? "");
  const target = await ownSubAccount(user.id, id);
  if (target) {
    await prisma.user.delete({ where: { id } });
    await logOperation(user, "iam.delete", target.username);
    revalidatePath("/settings");
  }
}

export async function resetIamPasswordAction(fd: FormData) {
  const user = await requireUser();
  if (user.role === "IAM") return;
  const id = String(fd.get("id") ?? "");
  const password = String(fd.get("password") ?? "");
  const target = await ownSubAccount(user.id, id);
  if (password.length >= 6 && target) {
    await prisma.user.update({ where: { id }, data: { passwordHash: hashPassword(password) } });
    await logOperation(user, "iam.reset", target.username);
    revalidatePath("/settings");
  }
}
