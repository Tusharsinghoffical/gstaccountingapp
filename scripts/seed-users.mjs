import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  console.log('Verifying & seeding test users and businesses...');

  // Ensure default business
  const business = await prisma.business.upsert({
    where: { id: 'biz-1' },
    update: {},
    create: {
      id: 'biz-1',
      name: 'Alpha Retailers Pvt Ltd',
      legalName: 'Alpha Retailers Private Limited',
      gstin: '27AABCU9603R1ZM',
      stateCode: '27',
      address: 'Shop 42, Phoenix Marketcity, Kurla West, Mumbai',
      pincode: '400070',
      email: 'admin@gstledger.local',
      phone: '+91 98765 43210',
    },
  });

  const passwordHash = await bcrypt.hash('admin123', 10);
  const accPasswordHash = await bcrypt.hash('acc123', 10);

  // Admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@gstledger.local' },
    update: { passwordHash },
    create: {
      id: 'usr-admin-1',
      name: 'Rajesh Sharma',
      email: 'admin@gstledger.local',
      passwordHash,
    },
  });

  // Accountant user
  const accountant = await prisma.user.upsert({
    where: { email: 'accountant@gstledger.local' },
    update: { passwordHash: accPasswordHash },
    create: {
      id: 'usr-acc-1',
      name: 'Priya Patel',
      email: 'accountant@gstledger.local',
      passwordHash: accPasswordHash,
    },
  });

  // Business memberships
  await prisma.businessUser.upsert({
    where: {
      businessId_userId: {
        businessId: business.id,
        userId: admin.id,
      },
    },
    update: { role: 'admin', status: 'active' },
    create: {
      businessId: business.id,
      userId: admin.id,
      role: 'admin',
      status: 'active',
    },
  });

  await prisma.businessUser.upsert({
    where: {
      businessId_userId: {
        businessId: business.id,
        userId: accountant.id,
      },
    },
    update: { role: 'accountant', status: 'active' },
    create: {
      businessId: business.id,
      userId: accountant.id,
      role: 'accountant',
      status: 'active',
    },
  });

  console.log('Seeded users successfully:');
  console.log('  1. admin@gstledger.local / admin123 (Role: admin)');
  console.log('  2. accountant@gstledger.local / acc123 (Role: accountant)');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
