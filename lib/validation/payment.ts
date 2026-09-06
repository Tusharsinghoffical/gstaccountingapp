import { z } from "zod";

export const paymentAllocationSchema = z.object({
  invoice_id: z.string().min(1, "Invoice ID is required"),
  allocated_amount: z.number().positive("Allocation amount must be greater than 0"),
});

export const recordPaymentSchema = z
  .object({
    party_type: z.enum(["customer", "supplier"]),
    party_id: z.string().min(1, "Customer or Supplier is required"),
    amount: z.number().positive("Payment amount must be greater than zero"),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
    mode: z.enum(["cash", "bank_transfer", "upi", "cheque", "other"]),
    reference_no: z.string().optional().or(z.literal("")),
    notes: z.string().optional().or(z.literal("")),
    allocations: z.array(paymentAllocationSchema).default([]),
  })
  .refine(
    (data) => {
      const totalAllocated = data.allocations.reduce(
        (sum, a) => sum + a.allocated_amount,
        0
      );
      // Allow precision tolerance of 0.01 for floating point calculations
      return totalAllocated <= data.amount + 0.01;
    },
    {
      message: "Total allocated amount cannot exceed the payment amount",
      path: ["allocations"],
    }
  );

export type PaymentAllocationInput = z.infer<typeof paymentAllocationSchema>;
export type RecordPaymentFormData = z.infer<typeof recordPaymentSchema>;
