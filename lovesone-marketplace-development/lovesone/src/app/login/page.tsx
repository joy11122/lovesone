import { AuthForm } from "@/components/storefront";
import { safeInternalPath } from "@/lib/security";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const params = await searchParams;
  const callbackUrl = safeInternalPath(params.callbackUrl, "/auth/redirect");
  return <section className="container py-14"><AuthForm mode="login" callbackUrl={callbackUrl} /></section>;
}
