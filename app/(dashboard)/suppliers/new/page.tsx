import React from "react";
import { PartyForm } from "@/components/parties";

export default function NewSupplierPage() {
  return (
    <div className="py-4">
      <PartyForm type="supplier" />
    </div>
  );
}
