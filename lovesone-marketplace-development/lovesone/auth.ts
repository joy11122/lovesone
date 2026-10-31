import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDatabase } from "@/lib/db";
import { User } from "@/models/User";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128)
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Google,
    Credentials({
      credentials: { email: {}, password: { type: "password" } },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        await connectDatabase();
        const user = await User.findOne({ email: parsed.data.email.toLowerCase(), status: "active" }).select("+passwordHash");
        if (!user?.passwordHash || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return null;
        return { id: String(user._id), name: user.name, email: user.email, role: user.role };
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && user.email) {
        // Google must assert that the mailbox is verified before it can be used
        // to create or access a LOVESONE account.
        if (profile?.email_verified !== true) return false;
        await connectDatabase();
        const email = user.email.toLowerCase();
        let existing = await User.findOne({ email });
        if (existing && existing.status !== "active") return false;
        if (!existing) {
          try {
            existing = await User.create({
              name: user.name || "Pet parent",
              email,
              role: "customer",
              status: "active"
            });
          } catch (error) {
            // A simultaneous first sign-in may win the unique email index.
            if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error;
            existing = await User.findOne({ email });
            if (!existing || existing.status !== "active") return false;
          }
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      const identityFilter = token.email
        ? { email: token.email.toLowerCase() }
        : token.sub
          ? { _id: token.sub }
          : null;

      if (identityFilter) {
        await connectDatabase();
        const record = await User.findOne({ ...identityFilter, status: "active" }).select("_id role");
        if (record) {
          // Refresh role on every JWT check so role changes take effect promptly.
          token.sub = String(record._id);
          token.role = record.role;
        } else {
          // Invalidate stale sessions immediately after suspension/deletion.
          token.sub = undefined;
          token.role = undefined;
        }
      } else if (user?.id) {
        token.sub = user.id;
        if ("role" in user && typeof user.role === "string") token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || "";
        session.user.role = typeof token.role === "string" ? token.role : "customer";
      }
      return session;
    }
  },
  pages: { signIn: "/login" }
});
