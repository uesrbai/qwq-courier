import { NextResponse } from "next/server";
import { authenticateIamKey } from "@/lib/api-auth";
import { createIamUser, listIamUsers } from "@/lib/iam-core";

// IAM 子账号管理（外部平台用）：平台(qwq)是唯一权威，密钥须开启「可管理 IAM」。
//   GET  /api/v1/iam           列出本密钥属主下的 IAM 子账号
//   POST /api/v1/iam           创建子账号（可预绑 qwq-sso）

export async function GET(req: Request) {
  const auth = await authenticateIamKey(req);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  const list = await listIamUsers(auth.parentId);
  return NextResponse.json({ success: true, count: list.length, accounts: list });
}

export async function POST(req: Request) {
  const auth = await authenticateIamKey(req);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "请求体不是合法 JSON / invalid JSON body" }, { status: 400 });
  }

  const r = await createIamUser(auth.parentId, {
    username: typeof body.username === "string" ? body.username : "",
    password: typeof body.password === "string" ? body.password : undefined,
    email: typeof body.email === "string" ? body.email : undefined,
    displayName: typeof body.displayName === "string" ? body.displayName : undefined,
    features: body.features,
    methods: body.methods,
    ssoSubject: typeof body.ssoSubject === "string" ? body.ssoSubject : undefined,
  });
  if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: r.status });
  return NextResponse.json(
    { success: true, account: r.user, ...(r.generatedPassword ? { password: r.generatedPassword } : {}) },
    { status: 201 },
  );
}
