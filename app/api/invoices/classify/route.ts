import { NextRequest, NextResponse } from "next/server";
import { classifyPurchaseInvoice } from "@/lib/ai/classifyInvoice";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const vendorName = body.vendor_name || body.vendorName || "";
    const lineItems = Array.isArray(body.line_items || body.lineItems)
      ? (body.line_items || body.lineItems)
      : [];

    const result = await classifyPurchaseInvoice({
      vendor_name: vendorName,
      line_items: lineItems,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to classify purchase invoice.",
      },
      { status: 500 }
    );
  }
}
