import { defineAction, ActionError, type ActionAPIContext } from "astro:actions";
import { z } from "astro:schema";
import { ColorPalettes, PaletteColors, and, db, eq, or } from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

async function getOwnedPalette(paletteId: string, userId: string) {
  const [palette] = await db
    .select()
    .from(ColorPalettes)
    .where(eq(ColorPalettes.id, paletteId));

  if (!palette) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Palette not found.",
    });
  }

  if (palette.userId !== userId && !palette.isSystem) {
    throw new ActionError({
      code: "FORBIDDEN",
      message: "You do not have access to this palette.",
    });
  }

  return palette;
}

export const server = {
  createPalette: defineAction({
    input: z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      sourceType: z.string().optional(),
      sourceReference: z.string().optional(),
      isFavorite: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const [palette] = await db
        .insert(ColorPalettes)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          name: input.name,
          description: input.description,
          sourceType: input.sourceType,
          sourceReference: input.sourceReference,
          isFavorite: input.isFavorite ?? false,
          isSystem: false,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return { success: true, data: { palette } };
    },
  }),

  updatePalette: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        name: z.string().optional(),
        description: z.string().optional(),
        sourceType: z.string().optional(),
        sourceReference: z.string().optional(),
        isFavorite: z.boolean().optional(),
      })
      .refine(
        (input) =>
          input.name !== undefined ||
          input.description !== undefined ||
          input.sourceType !== undefined ||
          input.sourceReference !== undefined ||
          input.isFavorite !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      const palette = await getOwnedPalette(input.id, user.id);

      const [updated] = await db
        .update(ColorPalettes)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
          ...(input.sourceReference !== undefined ? { sourceReference: input.sourceReference } : {}),
          ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}),
          updatedAt: new Date(),
        })
        .where(eq(ColorPalettes.id, input.id))
        .returning();

      return { success: true, data: { palette: updated } };
    },
  }),

  listPalettes: defineAction({
    input: z.object({
      favoritesOnly: z.boolean().default(false),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const filters = [or(eq(ColorPalettes.userId, user.id), eq(ColorPalettes.isSystem, true))];

      if (input.favoritesOnly) {
        filters.push(eq(ColorPalettes.isFavorite, true));
      }

      const palettes = await db.select().from(ColorPalettes).where(and(...filters));

      return { success: true, data: { items: palettes, total: palettes.length } };
    },
  }),

  createPaletteColor: defineAction({
    input: z.object({
      paletteId: z.string().min(1),
      orderIndex: z.number().int().optional(),
      hexValue: z.string().min(1),
      role: z.string().optional(),
      label: z.string().optional(),
      contrastOnLight: z.number().optional(),
      contrastOnDark: z.number().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedPalette(input.paletteId, user.id);

      const [color] = await db
        .insert(PaletteColors)
        .values({
          id: crypto.randomUUID(),
          paletteId: input.paletteId,
          orderIndex: input.orderIndex,
          hexValue: input.hexValue,
          role: input.role,
          label: input.label,
          contrastOnLight: input.contrastOnLight,
          contrastOnDark: input.contrastOnDark,
          createdAt: new Date(),
        })
        .returning();

      return { success: true, data: { color } };
    },
  }),

  updatePaletteColor: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        paletteId: z.string().min(1),
        orderIndex: z.number().int().optional(),
        hexValue: z.string().optional(),
        role: z.string().optional(),
        label: z.string().optional(),
        contrastOnLight: z.number().optional(),
        contrastOnDark: z.number().optional(),
      })
      .refine(
        (input) =>
          input.orderIndex !== undefined ||
          input.hexValue !== undefined ||
          input.role !== undefined ||
          input.label !== undefined ||
          input.contrastOnLight !== undefined ||
          input.contrastOnDark !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedPalette(input.paletteId, user.id);

      const [existing] = await db
        .select()
        .from(PaletteColors)
        .where(and(eq(PaletteColors.id, input.id), eq(PaletteColors.paletteId, input.paletteId)));

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Palette color not found.",
        });
      }

      const [color] = await db
        .update(PaletteColors)
        .set({
          ...(input.orderIndex !== undefined ? { orderIndex: input.orderIndex } : {}),
          ...(input.hexValue !== undefined ? { hexValue: input.hexValue } : {}),
          ...(input.role !== undefined ? { role: input.role } : {}),
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.contrastOnLight !== undefined ? { contrastOnLight: input.contrastOnLight } : {}),
          ...(input.contrastOnDark !== undefined ? { contrastOnDark: input.contrastOnDark } : {}),
        })
        .where(eq(PaletteColors.id, input.id))
        .returning();

      return { success: true, data: { color } };
    },
  }),

  deletePaletteColor: defineAction({
    input: z.object({
      id: z.string().min(1),
      paletteId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedPalette(input.paletteId, user.id);

      const result = await db
        .delete(PaletteColors)
        .where(and(eq(PaletteColors.id, input.id), eq(PaletteColors.paletteId, input.paletteId)));

      if (result.rowsAffected === 0) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Palette color not found.",
        });
      }

      return { success: true };
    },
  }),

  listPaletteColors: defineAction({
    input: z.object({
      paletteId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedPalette(input.paletteId, user.id);

      const colors = await db
        .select()
        .from(PaletteColors)
        .where(eq(PaletteColors.paletteId, input.paletteId));

      return { success: true, data: { items: colors, total: colors.length } };
    },
  }),
};
