import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { ZodType } from "zod";

/**
 * A minimal React Hook Form resolver for Zod.
 *
 * We do not use @hookform/resolvers: it declares an optional peer dependency
 * on valibot whose version range conflicts with the one its own @typeschema
 * chain pins, so npm refuses to install it without --legacy-peer-deps. Forcing
 * that flag would infect every teammate's install for a package we need
 * roughly twelve lines of.
 *
 * The contract is simple: return the parsed values on success, or a map of
 * field path -> error on failure.
 */
export function zodResolver<TFieldValues extends FieldValues>(
  schema: ZodType<TFieldValues>,
): Resolver<TFieldValues> {
  return async (values) => {
    const result = schema.safeParse(values);

    if (result.success) {
      return { values: result.data, errors: {} };
    }

    const errors: Record<string, { type: string; message: string }> = {};

    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (!path) continue;
      // Keep only the first error per field: showing three messages under one
      // input is noise, and the first is almost always the actionable one.
      if (errors[path]) continue;
      errors[path] = { type: issue.code, message: issue.message };
    }

    return {
      values: {},
      errors: errors as FieldErrors<TFieldValues>,
    };
  };
}
