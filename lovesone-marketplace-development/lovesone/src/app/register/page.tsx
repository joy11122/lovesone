import { AuthForm } from "@/components/storefront";
import { safeInternalPath } from "@/lib/security";

export const metadata = { title: "Create an account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const params = await searchParams;
  const callbackUrl = safeInternalPath(params.callbackUrl, "/auth/redirect");
  return <section className="container py-14"><AuthForm mode="register" callbackUrl={callbackUrl} /></section>;
}
