import { NextResponse } from "next/server";
import { z } from "zod";
import { adminSession, createSession, verifyAdminLogin } from "@/lib/admin-auth";

export const runtime = "nodejs";

const input = z.object({ username: z.string().trim().min(3).max(64), password: z.string().min(1).max(256) });

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json());
  if (!parsed.success || !(await verifyAdminLogin(parsed.data.username, parsed.data.password))) {
    return NextResponse.json({ error: "Username yoki password noto‘g‘ri." }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminSession.cookie, createSession(parsed.data.username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: adminSession.maxAge,
    path: "/",
  });
  return response;
}
