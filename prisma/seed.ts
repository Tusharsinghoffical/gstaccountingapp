import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function main() {
  console.log("🌱 Seeding database with clean initial development data...");

  // 1. Create Business
  const business = await prisma.business.upsert({
    where: { id: "biz-1" },
    update: {},
    create: {
      id: "biz-1",
      name: "Alpha Retailers Pvt Ltd",
      gstin: "27AABCU9603R1ZM",
      stateCode: "27",
      address: "Plot 10, Nariman Point, Mumbai 400021",
    },
  });

  // 2. Create Users with cost factor 12
  const passwordHash = await bcrypt.hash("Password@123", 12);

  let adminUser = await prisma.user.findFirst({
    where: {
      OR: [{ id: "usr-admin-1" }, { email: "accountant@alpha-retailers.in" }],
    },
  });
  if (adminUser) {
    adminUser = await prisma.user.update({
      where: { id: adminUser.id },
      data: {
        email: "accountant@alpha-retailers.in",
        name: "Rajesh Sharma",
        passwordHash,
        emailVerified: true,
      },
    });
  } else {
    adminUser = await prisma.user.create({
      data: {
        id: "usr-admin-1",
        email: "accountant@alpha-retailers.in",
        name: "Rajesh Sharma",
        passwordHash,
        emailVerified: true,
      },
    });
  }

  let accountantUser = await prisma.user.findFirst({
    where: {
      OR: [{ id: "usr-acc-1" }, { email: "priya.patel@alpha-retailers.in" }],
    },
  });
  if (accountantUser) {
    accountantUser = await prisma.user.update({
      where: { id: accountantUser.id },
      data: {
        email: "priya.patel@alpha-retailers.in",
        name: "Priya Patel",
        passwordHash,
        emailVerified: true,
      },
    });
  } else {
    accountantUser = await prisma.user.create({
      data: {
        id: "usr-acc-1",
        email: "priya.patel@alpha-retailers.in",
        name: "Priya Patel",
        passwordHash,
        emailVerified: true,
      },
    });
  }

  // 3. Link Users to Business
  await prisma.businessUser.upsert({
    where: {
      businessId_userId: {
        businessId: business.id,
        userId: adminUser.id,
      },
    },
    update: { role: "admin", status: "active" },
    create: {
      id: "bu-admin-1",
      businessId: business.id,
      userId: adminUser.id,
      role: "admin",
      status: "active",
    },
  });

  await prisma.businessUser.upsert({
    where: {
      businessId_userId: {
        businessId: business.id,
        userId: accountantUser.id,
      },
    },
    update: { role: "accountant", status: "active" },
    create: {
      id: "bu-acc-1",
      businessId: business.id,
      userId: accountantUser.id,
      role: "accountant",
      status: "active",
    },
  });

  // 4. Create Customers
  const cust1 = await prisma.customer.upsert({
    where: { id: "cust-1" },
    update: {},
    create: {
      id: "cust-1",
      businessId: business.id,
      name: "Bharat Enterprises",
      gstin: "27AAPFU0939F1ZV",
      stateCode: "27",
      email: "accounts@bharatent.in",
      phone: "9820012345",
      billingAddress: "Plot 42, MIDC Industrial Area, Pune, MH 411018",
      pan: "AAPFU0939F",
      isActive: true,
    },
  });

  const cust2 = await prisma.customer.upsert({
    where: { id: "cust-2" },
    update: {},
    create: {
      id: "cust-2",
      businessId: business.id,
      name: "Mahalaxmi Trading Co",
      gstin: "29AABCU9603R1ZK",
      stateCode: "29",
      email: "mahalaxmi.traders@gmail.com",
      phone: "9845098765",
      billingAddress: "Shop 12, Commercial Street, Bengaluru, KA 560001",
      pan: "AABCU9603R",
      isActive: true,
    },
  });

  await prisma.customer.upsert({
    where: { id: "cust-3" },
    update: {},
    create: {
      id: "cust-3",
      businessId: business.id,
      name: "Local Retail Walk-in Customer",
      stateCode: "27",
      phone: "9988776655",
      billingAddress: "Mumbai Central",
      isActive: true,
    },
  });

  // 5. Create Suppliers
  const supp1 = await prisma.supplier.upsert({
    where: { id: "supp-1" },
    update: {},
    create: {
      id: "supp-1",
      businessId: business.id,
      name: "Tata Steel Logistics & Supply",
      gstin: "27AAACT2828Q1ZU",
      stateCode: "27",
      email: "billing@tatasteel-logistics.com",
      phone: "9819011223",
      billingAddress: "Bombay House, Homi Mody Street, Mumbai 400001",
      pan: "AAACT2828Q",
      isActive: true,
    },
  });

  await prisma.supplier.upsert({
    where: { id: "supp-2" },
    update: {},
    create: {
      id: "supp-2",
      businessId: business.id,
      name: "Southern Paper Mills Ltd",
      gstin: "33AABCS1429B1Z8",
      stateCode: "33",
      email: "sales@southernpaper.in",
      phone: "9444055667",
      billingAddress: "Industrial Estate, Guindy, Chennai, TN 600032",
      pan: "AABCS1429B",
      isActive: true,
    },
  });

  // 6. Create Invoices and Items
  await prisma.invoice.upsert({
    where: { id: "inv-1" },
    update: {},
    create: {
      id: "inv-1",
      businessId: business.id,
      type: "sales",
      customerOrSupplierId: cust1.id,
      invoiceNo: "INV/2024-25/0001",
      invoiceDate: "2024-04-15",
      dueDate: "2024-05-15",
      status: "final",
      subtotal: 122881.36,
      cgst: 11059.32,
      sgst: 11059.32,
      igst: 0,
      total: 145000,
      financialYear: "2024-2025",
      notes: "Supply of consulting services",
      items: {
        create: [
          {
            id: "item-1",
            businessId: business.id,
            description: "IT Software Advisory",
            hsnCode: "998311",
            qty: 1,
            rate: 122881.36,
            discount: 0,
            taxableAmount: 122881.36,
            gstRate: 18,
            cgstAmount: 11059.32,
            sgstAmount: 11059.32,
            igstAmount: 0,
            amount: 145000,
          },
        ],
      },
    },
  });

  await prisma.invoice.upsert({
    where: { id: "inv-2" },
    update: {},
    create: {
      id: "inv-2",
      businessId: business.id,
      type: "sales",
      customerOrSupplierId: cust2.id,
      invoiceNo: "INV/2024-25/0002",
      invoiceDate: "2024-04-16",
      dueDate: "2024-05-16",
      status: "draft",
      subtotal: 75000,
      cgst: 0,
      sgst: 0,
      igst: 13500,
      total: 88500,
      financialYear: "2024-2025",
      notes: "Inter-state supply to Karnataka",
      items: {
        create: [
          {
            id: "item-2",
            businessId: business.id,
            description: "Consumer Electronics Components",
            hsnCode: "847130",
            qty: 5,
            rate: 15000,
            discount: 0,
            taxableAmount: 75000,
            gstRate: 18,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 13500,
            amount: 88500,
          },
        ],
      },
    },
  });

  await prisma.invoice.upsert({
    where: { id: "inv-3" },
    update: {},
    create: {
      id: "inv-3",
      businessId: business.id,
      type: "purchase",
      customerOrSupplierId: supp1.id,
      invoiceNo: "PUR/2024-25/0019",
      invoiceDate: "2024-04-17",
      dueDate: "2024-05-17",
      status: "final",
      subtotal: 200000,
      cgst: 18000,
      sgst: 18000,
      igst: 0,
      total: 236000,
      financialYear: "2024-2025",
      notes: "Raw materials logistics supply",
      items: {
        create: [
          {
            id: "item-3",
            businessId: business.id,
            description: "Industrial Logistics & Freight",
            hsnCode: "996511",
            qty: 1,
            rate: 200000,
            discount: 0,
            taxableAmount: 200000,
            gstRate: 18,
            cgstAmount: 18000,
            sgstAmount: 18000,
            igstAmount: 0,
            amount: 236000,
          },
        ],
      },
    },
  });

  // 7. Create Payment and Allocation
  const payment = await prisma.payment.upsert({
    where: { id: "pay-1" },
    update: {},
    create: {
      id: "pay-1",
      businessId: business.id,
      partyId: cust1.id,
      amount: 100000,
      date: "2024-04-20",
      mode: "bank_transfer",
      referenceNo: "HDFC998822",
      notes: "Part payment for IT advisory",
    },
  });

  await prisma.paymentAllocation.upsert({
    where: {
      paymentId_invoiceId: {
        paymentId: payment.id,
        invoiceId: "inv-1",
      },
    },
    update: {},
    create: {
      id: "alloc-1",
      businessId: business.id,
      paymentId: payment.id,
      invoiceId: "inv-1",
      allocatedAmount: 100000,
    },
  });

  // 8. Create Ledger Entries
  await prisma.ledgerEntry.upsert({
    where: { id: "led-1" },
    update: {},
    create: {
      id: "led-1",
      businessId: business.id,
      partyId: cust1.id,
      entryType: "debit",
      amount: 145000,
      refInvoiceId: "inv-1",
      description: "Tax Invoice INV/2024-25/0001 (Sales)",
      entryDate: "2024-04-15",
    },
  });

  await prisma.ledgerEntry.upsert({
    where: { id: "led-pay-1" },
    update: {},
    create: {
      id: "led-pay-1",
      businessId: business.id,
      partyId: cust1.id,
      entryType: "credit",
      amount: 100000,
      refPaymentId: payment.id,
      description: "Bank Transfer Receipt - Ref HDFC998822",
      entryDate: "2024-04-20",
    },
  });

  await prisma.ledgerEntry.upsert({
    where: { id: "led-2" },
    update: {},
    create: {
      id: "led-2",
      businessId: business.id,
      partyId: cust2.id,
      entryType: "debit",
      amount: 88500,
      refInvoiceId: "inv-2",
      description: "Tax Invoice INV/2024-25/0002 (Sales)",
      entryDate: "2024-04-16",
    },
  });

  await prisma.ledgerEntry.upsert({
    where: { id: "led-4" },
    update: {},
    create: {
      id: "led-4",
      businessId: business.id,
      partyId: supp1.id,
      entryType: "credit",
      amount: 236000,
      refInvoiceId: "inv-3",
      description: "Purchase Invoice PUR/2024-25/0019",
      entryDate: "2024-04-17",
    },
  });

  // 9. Create Audit Log
  await prisma.auditLog.upsert({
    where: { id: "aud-001" },
    update: {},
    create: {
      id: "aud-001",
      businessId: business.id,
      userId: adminUser.id,
      action: "INSERT",
      tableName: "invoices",
      recordId: "inv-1",
      diff: JSON.stringify({
        invoiceNo: "INV/2024-25/0001",
        total: 145000,
        status: "final",
      }),
    },
  });

  console.log("✅ Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
