import React from "react";
import { getCustomers, getSuppliers } from "@/app/actions/parties";
import { InvoiceForm } from "@/components/invoices";

export default async function NewInvoicePage() {
  const [customers, suppliers] = await Promise.all([
    getCustomers(),
    getSuppliers(),
  ]);

  return (
    <div className="py-2">
      <InvoiceForm
        customers={customers}
        suppliers={suppliers}
        businessStateCode="27"
      />
    </div>
  );
}
