import React from "react";
import { notFound } from "next/navigation";
import { getSupplierById } from "@/app/actions/parties";
import { PartyForm } from "@/components/parties";

export default async function EditSupplierPage({
  params,
}: {
  params: { id: string };
}) {
  const supplier = await getSupplierById(params.id);

  if (!supplier) {
    notFound();
  }

  return (
    <div className="py-4">
      <PartyForm
        type="supplier"
        initialData={{
          id: supplier.id,
          name: supplier.name,
          gstin: supplier.gstin || "",
          state_code: supplier.state_code,
          email: supplier.email || "",
          phone: supplier.phone || "",
          billing_address: supplier.billing_address || "",
          pan: supplier.pan || "",
        }}
      />
    </div>
  );
}
