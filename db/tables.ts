/**
 * Color Palette Generator - create and store color palettes.
 *
 * Design goals:
 * - Palettes grouped under a user, with per-color metadata.
 * - Support both simple hex lists and detailed roles (primary, accent, etc.).
 * - Ready for export to design/dev tools.
 */

import { defineTable, column, NOW } from "astro:db";

export const ColorPalettes = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),

    name: column.text(),                               // "Sunset Gradient", "Dashboard Theme"
    description: column.text({ optional: true }),
    sourceType: column.text({ optional: true }),       // "manual", "image", "url"
    sourceReference: column.text({ optional: true }),  // e.g. image URL or site URL

    isFavorite: column.boolean({ default: false }),
    isSystem: column.boolean({ default: false }),      // future: global curated palettes

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const PaletteColors = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    paletteId: column.text({
      references: () => ColorPalettes.columns.id,
    }),
    orderIndex: column.number({ optional: true }),     // color order in palette

    hexValue: column.text(),                           // "#FF5733"
    role: column.text({ optional: true }),             // "primary", "secondary", "accent", etc.
    label: column.text({ optional: true }),            // "Sunset orange", etc.

    contrastOnLight: column.number({ optional: true }),// WCAG contrast hints (optional)
    contrastOnDark: column.number({ optional: true }),

    createdAt: column.date({ default: NOW }),
  },
});

export const tables = {
  ColorPalettes,
  PaletteColors,
} as const;
