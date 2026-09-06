import React from "react";
import { PartyForm } from "@/components/parties";

export default function NewCustomerPage() {
  return (
    <div className="py-4">
      <PartyForm type="customer" />
    </div>
  );
}
