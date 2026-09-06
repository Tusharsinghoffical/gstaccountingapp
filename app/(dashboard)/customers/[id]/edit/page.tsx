import React from "react";
import { notFound } from "next/navigation";
import { getCustomerById } from "@/app/actions/parties";
import { PartyForm } from "@/components/parties";

export default async function EditCustomerPage({
  params,
}: {
  params: { id: string };
}) {
  const customer = await getCustomerById(params.id);

  if (!customer) {
    notFound();
  }

  return (
    <div className="py-4">
      <PartyForm
        type="customer"
        initialData={{
          id: customer.id,
          name: customer.name,
          gstin: customer.gstin || "",
          state_code: customer.state_code,
          email: customer.email || "",
          phone: customer.phone || "",
          billing_address: customer.billing_address || "",
          shipping_address: customer.shipping_address || "",
          pan: customer.pan || "",
        }}
      />
    </div>
  );
}
