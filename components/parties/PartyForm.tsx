"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { partyFormSchema, PartyFormData } from "@/lib/validation/party";
import { validateGSTIN } from "@/lib/validation/gstin";
import { INDIAN_STATES } from "@/lib/constants/states";
import { Button, Input } from "@/components/ui";

export interface PartyFormProps {
  type: "customer" | "supplier";
  initialData?: Partial<PartyFormData> & { id?: string };
  onSuccess?: () => void;
}

export const PartyForm: React.FC<PartyFormProps> = ({
  type,
  initialData,
  onSuccess,
}) => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PartyFormData>({
    resolver: zodResolver(partyFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      gstin: initialData?.gstin || "",
      state_code: initialData?.state_code || "27",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      billing_address: initialData?.billing_address || "",
      shipping_address: initialData?.shipping_address || "",
      pan: initialData?.pan || "",
    },
  });

  const watchedGstin = watch("gstin");
  const [gstinStatus, setGstinStatus] = useState<{
    tested: boolean;
    isValid: boolean;
    message?: string;
  }>({ tested: false, isValid: false });

  // Live client-side GSTIN format + checksum validation
  useEffect(() => {
    if (!watchedGstin || watchedGstin.trim().length === 0) {
      setGstinStatus({ tested: false, isValid: false });
      return;
    }

    const clean = watchedGstin.trim().toUpperCase();
    if (clean.length < 15) {
      setGstinStatus({
        tested: true,
        isValid: false,
        message: `${clean.length}/15 characters entered`,
      });
      return;
    }

    const result = validateGSTIN(clean);
    if (result.isValid) {
      setGstinStatus({
        tested: true,
        isValid: true,
        message: "Valid GSTIN (Luhn Mod-36 Checksum Verified)",
      });
      if (result.stateCode) {
        setValue("state_code", result.stateCode, { shouldValidate: true });
      }
      if (result.pan) {
        setValue("pan", result.pan, { shouldValidate: true });
      }
    } else {
      setGstinStatus({
        tested: true,
        isValid: false,
        message: result.error || "Invalid GSTIN Checksum",
      });
    }
  }, [watchedGstin, setValue]);

  const onSubmit = async (data: PartyFormData) => {
    setIsSubmitting(true);
    setServerError(null);

    try {
      // Dynamic import of server actions
      const { saveCustomer, saveSupplier } = await import(
        "@/app/actions/parties"
      );

      const action = type === "customer" ? saveCustomer : saveSupplier;
      const res = await action(data, initialData?.id);

      if (!res.success) {
        setServerError(res.error || "Failed to save record");
        return;
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push(type === "customer" ? "/customers" : "/suppliers");
        router.refresh();
      }
    } catch (err: any) {
      setServerError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = initialData?.id
    ? `Edit ${type === "customer" ? "Customer" : "Supplier"}`
    : `New ${type === "customer" ? "Customer" : "Supplier"}`;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-card max-w-2xl mx-auto"
    >
      <div>
        <h2 className="text-xl font-bold text-neutral-900">{title}</h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          {type === "customer"
            ? "Register a client for GST invoicing and receivable tracking."
            : "Register a vendor for purchase records and input tax credits."}
        </p>
      </div>

      {serverError && (
        <div className="p-3 rounded-lg bg-expense-50 border border-expense-200 text-expense-700 text-xs font-medium">
          {serverError}
        </div>
      )}

      <div className="space-y-4">
        {/* Name */}
        <Input
          label={`${type === "customer" ? "Customer" : "Supplier"} Legal Name`}
          required
          placeholder="e.g. Bharat Enterprises"
          error={errors.name?.message}
          {...register("name")}
        />

        {/* GSTIN Field with Live Checksum Status */}
        <div className="space-y-1.5">
          <Input
            label="GSTIN (15 characters)"
            placeholder="e.g. 27AAPFU0939F1ZV"
            error={errors.gstin?.message}
            helperText="Leave blank for unregistered B2C clients. Automatically verifies format & Mod-36 checksum."
            {...register("gstin")}
          />

          {/* Live Checksum Feedback Badge */}
          {gstinStatus.tested && (
            <div
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border ${
                gstinStatus.isValid
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  gstinStatus.isValid ? "bg-emerald-600" : "bg-amber-600"
                }`}
              />
              <span>{gstinStatus.message}</span>
            </div>
          )}
        </div>

        {/* State Code Dropdown and PAN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-neutral-700 tracking-wide">
              GST Place of Supply (State) <span className="text-expense-500">*</span>
            </label>
            <select
              {...register("state_code")}
              className="w-full h-10 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              {INDIAN_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.code} - {state.name}
                </option>
              ))}
            </select>
            {errors.state_code && (
              <p className="text-xs text-expense-600 font-medium">
                {errors.state_code.message}
              </p>
            )}
          </div>

          <Input
            label="Permanent Account Number (PAN)"
            placeholder="e.g. AAPFU0939F"
            error={errors.pan?.message}
            helperText="Auto-extracted from GSTIN characters 3 to 12"
            {...register("pan")}
          />
        </div>

        {/* Contact info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Phone / Mobile Number"
            placeholder="e.g. 9820012345"
            error={errors.phone?.message}
            {...register("phone")}
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="accounts@example.in"
            error={errors.email?.message}
            {...register("email")}
          />
        </div>

        {/* Billing Address */}
        <div className="space-y-1.5 text-left">
          <label className="block text-xs font-semibold text-neutral-700 tracking-wide">
            Registered Billing Address
          </label>
          <textarea
            rows={2}
            placeholder="Street address, City, District, PIN Code"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            {...register("billing_address")}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100">
        <Button
          variant="outline"
          onClick={() =>
            router.push(type === "customer" ? "/customers" : "/suppliers")
          }
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button variant="primary" type="submit" isLoading={isSubmitting}>
          {initialData?.id ? "Save Changes" : `Create ${type === "customer" ? "Customer" : "Supplier"}`}
        </Button>
      </div>
    </form>
  );
};
