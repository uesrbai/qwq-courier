import { NextResponse } from "next/server";
import { authenticateIamKey } from "@/lib/api-auth";
import { getIamUser, updateIamUser, deleteIamUser } from "@/lib/iam-core";

// 单个 IAM 子账号：
//   GET    /api/v1/iam/:id    查看
//   PATCH  /api/v1/iam/:id    更新（displayName/password/features/methods/enabled/ssoSubject）
//                             停用/启用 = PATCH {"enabled": false/true}
//   DELETE /api/v1/iam/:id    删除
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const auth = await authenticateIamKey(req);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  const { id } = await params;
  const r = await getIamUser(auth.parentId, id);
  if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: r.status });
  return NextResponse.json({ success: true, account: r.user });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await authenticateIamKey(req);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "请求体不是合法 JSON / invalid JSON body" }, { status: 400 });
  }

  const r = await updateIamUser(auth.parentId, id, {
    displayName: typeof body.displayName === "string" ? body.displayName : undefined,
    password: typeof body.password === "string" ? body.password : undefined,
    features: body.features,
    methods: body.methods,
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    // ssoSubject: 传字符串=(重)绑，传 null 或空串=解绑，不传=不动
    ssoSubject:
      body.ssoSubject === null
        ? null
        : typeof body.ssoSubject === "string"
          ? body.ssoSubject
          : undefined,
  });
  if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: r.status });
  return NextResponse.json({ success: true, account: r.user });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await authenticateIamKey(req);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  const { id } = await params;
  const r = await deleteIamUser(auth.parentId, id);
  if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: r.status });
  return NextResponse.json({ success: true, deleted: r.user.id });
}
