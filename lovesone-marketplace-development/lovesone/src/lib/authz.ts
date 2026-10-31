import "server-only";
import { redirect } from "next/navigation";
import { auth } from "../../auth";

export type AppRole = "customer" | "vendor" | "admin" | "super-admin";

export async function requireRole(allowedRoles: AppRole[]) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role as AppRole | undefined;
  if (!role || !allowedRoles.includes(role)) redirect("/");
  return { id: session.user.id, name: session.user.name ?? "Pet parent", email: session.user.email ?? "", role };
}
