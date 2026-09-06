import { z } from "zod";

/**
 * Schema for inviting a new team member to the current business.
 * Role assignment is restricted to 'accountant' and 'auditor' per Prompt 23 requirements.
 */
export const inviteUserSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email address is required")
    .email("Please enter a valid email address"),
  role: z.enum(["accountant", "auditor"], {
    errorMap: () => ({
      message: "Please assign a valid role (Accountant or Auditor)",
    }),
  }),
});

export type InviteUserFormData = z.infer<typeof inviteUserSchema>;
