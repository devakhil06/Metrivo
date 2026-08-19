import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../src/lib/db";
import { Business } from "../src/lib/models";
import { reclassifyBusiness } from "../src/lib/reclassify";

async function main() {
  await connectDb();
  const name = process.argv[2];
  const filter = name ? { name: new RegExp(name, "i") } : {};
  const businesses = await Business.find(filter);

  for (const b of businesses) {
    const updated = await reclassifyBusiness(b._id.toString());
    await mongoose.connection.db!.collection("kpis").deleteOne({ businessId: b._id.toString() });
    console.log(`Reclassified "${b.name}": ${updated} transaction(s) updated`);
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
