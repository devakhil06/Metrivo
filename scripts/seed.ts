import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function seed() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);

  const db = mongoose.connection.db!;

  const users = db.collection("users");
  const businesses = db.collection("businesses");
  const transactions = db.collection("transactions");

  const email = "demo@metrivo.ai";
  const password = "demo1234";

  const existing = await users.findOne({ email });
  let userId;
  if (existing) {
    userId = existing._id;
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    const res = await users.insertOne({ email, name: "Demo Owner", passwordHash, createdAt: new Date(), updatedAt: new Date() });
    userId = res.insertedId;
  }

  const biz = await businesses.findOne({ ownerId: userId });
  const businessId =
    biz?._id ??
    (
      await businesses.insertOne({
        ownerId: userId,
        name: "Sunrise Traders",
        businessType: "retail",
        industry: "clothing",
        currency: "INR",
        country: "India",
        revenueModel: "product_sales",
        startDate: "2025-01-01",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    ).insertedId;

  await transactions.deleteMany({ businessId });

  function mulberry32(seed: number) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rand = mulberry32(42);
  const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

  const salesMerchants = ["FreshMart", "Kiran Stores", "City Style", "Om Textiles", "Blue Leaf", "Metro Mart"];
  const suppliers = ["Wholesale Fabrics", "Garment Hub", "Trim Traders", "Packwell Supplies"];

  const docs: any[] = [];
  const now = new Date();
  const months = 7;

  for (let i = months - 1; i >= 0; i--) {
    const base = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() - i + 1, 0).getDate();

    const seasonality = 0.85 + 0.3 * Math.sin((months - 1 - i) / 2);
    const decline = i === 0 ? 0.85 : i === 1 ? 0.95 : 1;
    const expenseBoost = i === 0 ? 1.3 : 1;

    const salesCount = between(24, 34);
    for (let s = 0; s < salesCount; s++) {
      docs.push({
        businessId,
        date: new Date(base.getFullYear(), base.getMonth(), between(1, lastDay)),
        amount: Math.round((between(400, 18000) * seasonality * decline) / 10) * 10,
        direction: "credit",
        description: `UPI/${pick(salesMerchants)}`,
        merchant: pick(salesMerchants),
        category: "revenue",
        subcategory: "sales",
        paymentMethod: "UPI",
        currency: "INR",
        confidence: 0.9,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    docs.push({
      businessId,
      date: new Date(base.getFullYear(), base.getMonth(), 3),
      amount: 25000,
      direction: "debit",
      description: "Rent payment - Shop premises",
      merchant: "Premises Rent",
      category: "expenses",
      subcategory: "rent",
      paymentMethod: "NEFT",
      currency: "INR",
      confidence: 0.9,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    for (let e = 0; e < 3; e++) {
      docs.push({
        businessId,
        date: new Date(base.getFullYear(), base.getMonth(), 5),
        amount: 14000,
        direction: "debit",
        description: "Salary transfer - Staff",
        merchant: "Staff Salary",
        category: "expenses",
        subcategory: "salary",
        paymentMethod: "NEFT",
        currency: "INR",
        confidence: 0.9,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const invCount = between(3, 6);
    for (let p = 0; p < invCount; p++) {
      docs.push({
        businessId,
        date: new Date(base.getFullYear(), base.getMonth(), between(8, lastDay)),
        amount: Math.round((between(8000, 35000) * expenseBoost) / 10) * 10,
        direction: "debit",
        description: `Purchase - ${pick(suppliers)}`,
        merchant: pick(suppliers),
        category: "expenses",
        subcategory: "inventory",
        paymentMethod: "NEFT",
        currency: "INR",
        confidence: 0.9,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    for (let u = 0; u < 3; u++) {
      docs.push({
        businessId,
        date: new Date(base.getFullYear(), base.getMonth(), between(5, 20)),
        amount: between(1200, 4000),
        direction: "debit",
        description: pick(["Electricity bill", "Internet bill", "Water utility bill"]),
        category: "expenses",
        subcategory: "utilities",
        paymentMethod: "UPI",
        currency: "INR",
        confidence: 0.9,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    for (let m = 0; m < 2; m++) {
      docs.push({
        businessId,
        date: new Date(base.getFullYear(), base.getMonth(), between(10, 24)),
        amount: between(3000, 9000),
        direction: "debit",
        description: pick(["Facebook ads", "Instagram promotion", "Google ads campaign"]),
        category: "expenses",
        subcategory: "marketing",
        paymentMethod: "UPI",
        currency: "INR",
        confidence: 0.9,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    for (let l = 0; l < 4; l++) {
      docs.push({
        businessId,
        date: new Date(base.getFullYear(), base.getMonth(), between(6, lastDay)),
        amount: between(800, 4500),
        direction: "debit",
        description: pick(["Fuel - delivery van", "Courier charges", "Transport - goods"]),
        category: "expenses",
        subcategory: "logistics",
        paymentMethod: "UPI",
        currency: "INR",
        confidence: 0.9,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  await transactions.insertMany(docs);

  console.log("Seed complete.");
  console.log(`  Business: Sunrise Traders (${docs.length} transactions)`);
  console.log(`  Login:    ${email}`);
  console.log(`  Password: ${password}`);
  await mongoose.disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
