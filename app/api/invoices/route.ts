import { NextResponse, NextRequest } from "next/server";
import { createInvoice } from "@/app/actions/invoices";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await createInvoice(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to process invoice" },
      { status: 500 }
    );
  }
}
