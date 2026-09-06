import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { assertBusinessMembership } from "@/lib/auth/authorize";
import { getGstr1Report } from "@/app/actions/reports";
import { generateGstr1ExcelWorkbook } from "@/lib/reports/exportGstr1Xlsx";
import type { Gstr1PeriodFilter } from "@/lib/reports/gstr1";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId") || session.user?.businesses?.[0]?.businessId;
    if (!businessId) {
      return NextResponse.json({ error: "Missing business context" }, { status: 400 });
    }

    await assertBusinessMembership(userId, businessId);

    const financialYear = searchParams.get("financialYear") || "2024-25";
    const periodType = (searchParams.get("periodType") || "month") as "month" | "quarter";
    const month = searchParams.get("month") || "04";
    const quarter = (searchParams.get("quarter") || "Q1") as "Q1" | "Q2" | "Q3" | "Q4";

    const filter: Gstr1PeriodFilter = {
      financialYear,
      periodType,
      month: periodType === "month" ? month : undefined,
      quarter: periodType === "quarter" ? quarter : undefined,
    };

    const reportData = await getGstr1Report(filter, businessId);

    const biz = await prisma.business.findUnique({
      where: { id: businessId },
    });

    const businessInfo = {
      name: biz?.name || "Business Enterprise",
      gstin: biz?.gstin || "N/A",
    };

    // Server-side export using exceljs
    const xlsxBuffer = await generateGstr1ExcelWorkbook(reportData, businessInfo);
    const cleanPeriod = (reportData.period_label || "Return").replace(/[\s/]/g, "_");
    const filename = `GSTR1_${cleanPeriod}.xlsx`;

    return new NextResponse(new Uint8Array(xlsxBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while exporting GSTR-1.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
