import { TRPCError } from "@trpc/server";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { users } from "~/server/db/schema";

export const authRouter = createTRPCRouter({
  /** Email/password registration; sign-in afterwards goes through NextAuth's
   * credentials provider. */
  register: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(50),
        email: z.string().trim().toLowerCase().email(),
        password: z.string().min(8).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.users.findFirst({
        where: eq(users.email, input.email),
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists",
        });
      }

      const passwordHash = await hash(input.password, 12);
      await ctx.db.insert(users).values({
        name: input.name,
        email: input.email,
        passwordHash,
        emailVerified: null,
      });

      return { ok: true };
    }),
});
