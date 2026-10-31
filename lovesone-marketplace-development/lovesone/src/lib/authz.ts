import "server-only";
import { redirect } from "next/navigation";
import { auth } from "../../auth";

export type AppRole = "customer" | "vendor" | "admin" | "super-admin";

export async function requireRole(allowedRoles: AppRole[], returnTo = "/account") {
  const session = await auth();
  if (!session?.user?.id) {\n    const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/account";\n    redirect(`/login?callbackUrl=${encodeURIComponent(safeReturnTo)}`);\n  }
  const role = session.user.role as AppRole | undefined;
  if (!role || !allowedRoles.includes(role)) redirect("/");
  return { id: session.user.id, name: session.user.name ?? "Pet parent", email: session.user.email ?? "", role };
}
