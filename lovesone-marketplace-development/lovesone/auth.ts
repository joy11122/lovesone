import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDatabase } from "@/lib/db";
import { User } from "@/models/User";

const credentialsSchema = z.object({
  email: z.string().email(),
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
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        await connectDatabase();
        const email = user.email.toLowerCase();
        const existing = await User.findOne({ email });
        if (existing && existing.status !== "active") return false;
        if (!existing) {
          await User.create({
            name: user.name || "Pet parent",
            email,
            role: "customer",
            status: "active"
          });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (token.email) {
        await connectDatabase();
        const record = await User.findOne({ email: token.email.toLowerCase(), status: "active" }).select("_id role");
        if (record) {
          // Always expose the application's MongoDB user ID, not Google's provider ID.
          token.sub = String(record._id);
          token.role = record.role;
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
