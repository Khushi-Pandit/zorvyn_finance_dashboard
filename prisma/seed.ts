import { PrismaClient, Role, UserStatus, RecordType, CategoryType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ─── CATEGORIES ──────────────────────────────────────────────────────────────
  const categories = [
    { name: 'Salary', type: CategoryType.INCOME, color: '#16A34A', icon: 'briefcase', isSystem: true },
    { name: 'Freelance Income', type: CategoryType.INCOME, color: '#0EA5E9', icon: 'laptop', isSystem: true },
    { name: 'Investment Returns', type: CategoryType.INCOME, color: '#7C3AED', icon: 'trending-up', isSystem: true },
    { name: 'Other Income', type: CategoryType.INCOME, color: '#6EE7B7', icon: 'plus-circle', isSystem: true },
    { name: 'Rent / Mortgage', type: CategoryType.EXPENSE, color: '#DC2626', icon: 'home', isSystem: true },
    { name: 'Utilities', type: CategoryType.EXPENSE, color: '#D97706', icon: 'zap', isSystem: true },
    { name: 'Groceries', type: CategoryType.EXPENSE, color: '#F59E0B', icon: 'shopping-cart', isSystem: true },
    { name: 'Transport', type: CategoryType.EXPENSE, color: '#6B7280', icon: 'car', isSystem: true },
    { name: 'Healthcare', type: CategoryType.EXPENSE, color: '#EF4444', icon: 'heart', isSystem: true },
    { name: 'Education', type: CategoryType.EXPENSE, color: '#3B82F6', icon: 'book', isSystem: true },
    { name: 'Entertainment', type: CategoryType.EXPENSE, color: '#EC4899', icon: 'film', isSystem: true },
    { name: 'Dining Out', type: CategoryType.EXPENSE, color: '#F97316', icon: 'coffee', isSystem: true },
    { name: 'Insurance', type: CategoryType.EXPENSE, color: '#8B5CF6', icon: 'shield', isSystem: true },
    { name: 'Transfer', type: CategoryType.BOTH, color: '#94A3B8', icon: 'repeat', isSystem: true },
  ];

  console.log('📂 Creating categories...');
  const createdCategories: Record<string, string> = {};
  for (const cat of categories) {
    const created = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    createdCategories[cat.name] = created.id;
  }
  console.log(`   ✓ ${categories.length} categories created`);

  // ─── USERS ───────────────────────────────────────────────────────────────────
  const BCRYPT_COST = 10;

  const users = [
    {
      email: 'admin@finapi.dev',
      password: 'Admin@12345',
      fullName: 'System Admin',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'analyst@finapi.dev',
      password: 'Analyst@12345',
      fullName: 'Finance Analyst',
      role: Role.ANALYST,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'viewer@finapi.dev',
      password: 'Viewer@12345',
      fullName: 'Dashboard Viewer',
      role: Role.VIEWER,
      status: UserStatus.ACTIVE,
    },
  ];

  console.log('👥 Creating users...');
  const createdUsers: Record<string, string> = {};
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, BCRYPT_COST);
    const created = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash,
        fullName: u.fullName,
        role: u.role,
        status: u.status,
      },
    });
    createdUsers[u.email] = created.id;
    console.log(`   ✓ ${u.role}: ${u.email} / ${u.password}`);
  }

  const adminId = createdUsers['admin@finapi.dev'];

  // ─── FINANCIAL RECORDS ───────────────────────────────────────────────────────
  console.log('💰 Creating financial records...');

  const now = new Date();
  const recordsData = [];

  // Generate 50 records across 6 months
  for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
    const month = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const monthStr = month.toISOString().slice(0, 7);

    // Monthly salary
    recordsData.push({
      amount: 8500,
      type: RecordType.INCOME,
      date: new Date(`${monthStr}-01`),
      description: 'Monthly salary payment',
      currency: 'USD',
      tags: ['salary', 'regular'],
      categoryId: createdCategories['Salary'],
      createdById: adminId,
      lastModifiedById: adminId,
    });

    // Rent
    recordsData.push({
      amount: 1800,
      type: RecordType.EXPENSE,
      date: new Date(`${monthStr}-01`),
      description: 'Monthly rent payment',
      currency: 'USD',
      tags: ['rent', 'housing', 'regular'],
      categoryId: createdCategories['Rent / Mortgage'],
      createdById: adminId,
      lastModifiedById: adminId,
    });

    // Utilities
    recordsData.push({
      amount: +(120 + Math.random() * 80).toFixed(2),
      type: RecordType.EXPENSE,
      date: new Date(`${monthStr}-05`),
      description: 'Electricity and water bill',
      currency: 'USD',
      tags: ['utilities', 'regular'],
      categoryId: createdCategories['Utilities'],
      createdById: adminId,
      lastModifiedById: adminId,
    });

    // Groceries (twice per month)
    recordsData.push({
      amount: +(250 + Math.random() * 100).toFixed(2),
      type: RecordType.EXPENSE,
      date: new Date(`${monthStr}-08`),
      description: 'Weekly grocery shopping',
      currency: 'USD',
      tags: ['groceries', 'food'],
      categoryId: createdCategories['Groceries'],
      createdById: adminId,
      lastModifiedById: adminId,
    });

    recordsData.push({
      amount: +(200 + Math.random() * 80).toFixed(2),
      type: RecordType.EXPENSE,
      date: new Date(`${monthStr}-20`),
      description: 'Mid-month groceries',
      currency: 'USD',
      tags: ['groceries', 'food'],
      categoryId: createdCategories['Groceries'],
      createdById: adminId,
      lastModifiedById: adminId,
    });

    // Transport
    recordsData.push({
      amount: +(80 + Math.random() * 60).toFixed(2),
      type: RecordType.EXPENSE,
      date: new Date(`${monthStr}-10`),
      description: 'Monthly transport pass and fuel',
      currency: 'USD',
      tags: ['transport', 'commute'],
      categoryId: createdCategories['Transport'],
      createdById: adminId,
      lastModifiedById: adminId,
    });

    // Dining
    recordsData.push({
      amount: +(60 + Math.random() * 90).toFixed(2),
      type: RecordType.EXPENSE,
      date: new Date(`${monthStr}-14`),
      description: 'Dining out with family',
      currency: 'USD',
      tags: ['dining', 'food'],
      categoryId: createdCategories['Dining Out'],
      createdById: adminId,
      lastModifiedById: adminId,
    });

    // Entertainment
    recordsData.push({
      amount: +(30 + Math.random() * 70).toFixed(2),
      type: RecordType.EXPENSE,
      date: new Date(`${monthStr}-16`),
      description: 'Streaming subscriptions and movies',
      currency: 'USD',
      tags: ['entertainment', 'subscriptions'],
      categoryId: createdCategories['Entertainment'],
      createdById: adminId,
      lastModifiedById: adminId,
    });

    // Freelance income (not every month)
    if (monthOffset % 2 === 0) {
      recordsData.push({
        amount: +(1500 + Math.random() * 2000).toFixed(2),
        type: RecordType.INCOME,
        date: new Date(`${monthStr}-15`),
        description: 'Freelance project payment',
        currency: 'USD',
        tags: ['freelance', 'project'],
        categoryId: createdCategories['Freelance Income'],
        createdById: adminId,
        lastModifiedById: adminId,
      });
    }

    // Investment returns (quarterly)
    if (monthOffset % 3 === 0) {
      recordsData.push({
        amount: +(500 + Math.random() * 800).toFixed(2),
        type: RecordType.INCOME,
        date: new Date(`${monthStr}-28`),
        description: 'Quarterly investment dividend',
        currency: 'USD',
        tags: ['investment', 'dividend', 'passive'],
        categoryId: createdCategories['Investment Returns'],
        createdById: adminId,
        lastModifiedById: adminId,
      });
    }
  }

  for (const record of recordsData) {
    await prisma.financialRecord.create({ data: record });
  }
  console.log(`   ✓ ${recordsData.length} financial records created`);

  console.log('\n✅ Seed complete!');
  console.log('\n📋 Login credentials:');
  console.log('   Admin:   admin@finapi.dev   / Admin@12345');
  console.log('   Analyst: analyst@finapi.dev / Analyst@12345');
  console.log('   Viewer:  viewer@finapi.dev  / Viewer@12345');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });