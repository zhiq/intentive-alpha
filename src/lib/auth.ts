import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { UserRole } from "@prisma/client";
import { ForbiddenError } from "@/domain/errors";

// Local alpha auth. There is NO real authentication in the alpha — instead we
// impersonate one of the seeded users via a cookie. This keeps the focus on the
// market mechanics while still exercising server-side authorization everywhere
// (every service checks ownership/role using the session this returns).
//
// Replacing this with Auth.js later is a single-file change: keep getSession()'s
// contract and swap the implementation.

const SESSION_COOKIE = "intentive_session_user";

export interface Session {
  userId: string;
  role: UserRole;
  name: string;
  email: string;
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const userId = store.get(SESSION_COOKIE)?.value;
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      return {
        userId: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
      };
    }
  }
  // Default impersonation: first USER (keeps the alpha demoable out of the box).
  const fallback = await prisma.user.findFirst({
    where: { role: UserRole.USER },
    orderBy: { createdAt: "asc" },
  });
  if (!fallback) return null;
  return {
    userId: fallback.id,
    role: fallback.role,
    name: fallback.name,
    email: fallback.email,
  };
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new ForbiddenError("No session");
  return session;
}

export async function requireRole(...roles: UserRole[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.role)) {
    throw new ForbiddenError(`Requires role: ${roles.join(", ")}`);
  }
  return session;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
