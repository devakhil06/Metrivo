import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Transaction, FileModel } from "@/lib/models";
import { getBusinessForUser, json, handleError, invalidateAnalyticsCache } from "@/lib/api";
import { parseSpreadsheet } from "@/lib/parse";
import { classifyTransaction, extractMerchant } from "@/lib/classify";
import { analyzeBusiness, parseCsv } from "@/lib/python";
import { dedupKey } from "@/lib/preprocess";
import { backfillDedupKeys } from "@/lib/dedupe";
import { enforceRateLimit } from "@/lib/rate-limit";
import { rateLimitIdentity } from "@/lib/security";

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_MULTIPART_SIZE = MAX_SIZE + 1024 * 1024;
const MAX_TRANSACTIONS = 100_000;
const ALLOWED_EXTENSIONS = new Set(["csv", "xlsx", "xls"]);

interface Raw {
  date: Date;
  amount: number;
  direction: "credit" | "debit";
  rawType?: string;
  description: string;
  merchant?: string;
  paymentMethod?: string;
}

function inferMethod(desc: string): string | undefined {
  const d = desc.toUpperCase();
  if (d.includes("UPI")) return "UPI";
  if (d.includes("NEFT")) return "NEFT";
  if (d.includes("IMPS")) return "IMPS";
  if (d.includes("RTGS")) return "RTGS";
  if (d.includes("ATM") || d.includes("CARD") || d.includes("POS")) return "Card";
  return undefined;
}

function validateFile(file: File, buffer: Buffer): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.has(extension)) return "Only CSV, XLSX and XLS files are supported";
  if (file.name.length > 180) return "Filename is too long";

  if (extension === "xlsx" && !(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
    return "The XLSX file signature is invalid";
  }
  if (
    extension === "xls" &&
    !Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).equals(buffer.subarray(0, 8))
  ) {
    return "The XLS file signature is invalid";
  }
  if (extension === "csv" && buffer.includes(0)) {
    return "The CSV file contains unsupported binary data";
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    await connectDb();
    const business = await getBusinessForUser(user._id.toString());
    if (!business) return json({ error: "Create your business profile first" }, 400);

    await enforceRateLimit({
      scope: "upload",
      identity: rateLimitIdentity(business._id.toString()),
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });

    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_MULTIPART_SIZE) return json({ error: "File too large (max 10MB)" }, 413);

    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) return json({ error: "No file provided" }, 400);
    if (file.size > MAX_SIZE) return json({ error: "File too large (max 10MB)" }, 413);

    const buffer = Buffer.from(await file.arrayBuffer());
    const invalidFile = validateFile(file, buffer);
    if (invalidFile) return json({ error: invalidFile }, 400);
    const businessId = business._id.toString();
    const isCsv = /\.csv$/i.test(file.name);

    let raw: Raw[] = [];
    let warnings: string[] = [];
    let summary:
      | { totalIncome: number; totalExpenses: number; incomeCount: number; expenseCount: number; skipped: number }
      | undefined;

    if (isCsv) {
      const py = await parseCsv(file);
      if (py && py.transactions.length > 0) {
        raw = py.transactions.map((t) => ({
          date: new Date(t.date),
          amount: t.amount,
          direction: t.direction,
          rawType: t.rawType ?? undefined,
          description: t.description,
          paymentMethod: t.paymentMethod ?? undefined,
        }));
        summary = {
          totalIncome: py.summary.totalIncome,
          totalExpenses: py.summary.totalExpenses,
          incomeCount: py.summary.incomeCount,
          expenseCount: py.summary.expenseCount,
          skipped: py.summary.skipped,
        };
        if (py.summary.skipped > 0) warnings.push(`${py.summary.skipped} row(s) skipped (missing date or amount)`);
      } else {
        const parsed = parseSpreadsheet(buffer, file.name);
        raw = parsed.transactions;
        warnings = parsed.warnings;
      }
    } else {
      const parsed = parseSpreadsheet(buffer, file.name);
      raw = parsed.transactions;
      warnings = parsed.warnings;
    }

    if (raw.length > MAX_TRANSACTIONS) {
      return json({ error: `Too many transactions (max ${MAX_TRANSACTIONS.toLocaleString("en-IN")})` }, 413);
    }

    await backfillDedupKeys(businessId);

    const existingRows = await Transaction.find(
      { businessId: business._id },
      { date: 1, amount: 1, direction: 1, description: 1 }
    ).lean();

    const contentKey = (date: Date, amount: number, description: string) =>
      `${date.toISOString().slice(0, 10)}|${amount}|${String(description).toLowerCase().trim()}`;

    const byContent = new Map<string, { _id: unknown; direction: string }>();
    for (const row of existingRows) {
      const k = contentKey(row.date, row.amount, row.description || "");
      if (!byContent.has(k)) byContent.set(k, { _id: row._id, direction: row.direction });
    }

    const seen = new Set<string>();
    const valid: Record<string, unknown>[] = [];
    const repairs: { updateOne: { filter: Record<string, unknown>; update: Record<string, unknown> } }[] = [];
    let duplicates = 0;
    let repaired = 0;

    for (const r of raw) {
      const key = dedupKey(businessId, r.date, r.amount, r.direction, r.description);
      if (seen.has(key)) {
        duplicates++;
        continue;
      }
      seen.add(key);

      const existing = byContent.get(contentKey(r.date, r.amount, r.description || ""));
      if (existing) {
        if (existing.direction === r.direction) {
          duplicates++;
          continue;
        }
        const { category, subcategory, confidence } = classifyTransaction(r.direction, r.description);
        repairs.push({
          updateOne: {
            filter: { _id: existing._id },
            update: {
              $set: {
                direction: r.direction,
                rawType: r.rawType,
                category,
                subcategory,
                confidence,
                dedupKey: key,
              },
            },
          },
        });
        repaired++;
        continue;
      }

      const { category, subcategory, confidence } = classifyTransaction(r.direction, r.description);
      valid.push({
        businessId: business._id,
        date: r.date,
        amount: r.amount,
        direction: r.direction,
        rawType: r.rawType,
        description: r.description,
        merchant: r.merchant || extractMerchant(r.description),
        category,
        subcategory,
        paymentMethod: r.paymentMethod || inferMethod(r.description),
        currency: business.currency,
        confidence,
        dedupKey: key,
      });
    }

    if (repairs.length > 0) {
      await Transaction.collection.bulkWrite(repairs);
    }

    const existingDuplicates = duplicates;

    if (raw.length === 0) {
      return json(
        {
          error:
            "Could not read any transactions from this file. Make sure it has a date column and an amount or debit/credit column.",
          quality: { processed: 0, imported: 0, duplicates: 0, existingDuplicates: 0, warnings },
        },
        400
      );
    }

    if (valid.length === 0 && repaired === 0) {
      return json(
        {
          error: `All ${raw.length} rows in this file were already imported earlier (${duplicates} exact match${duplicates === 1 ? "" : "es"}). Nothing new to add — your data is already in the system.`,
          redundant: true,
          quality: { processed: raw.length, imported: 0, duplicates, existingDuplicates, warnings },
        },
        409
      );
    }

    const fileRecord = await FileModel.create({
      businessId: business._id,
      filename: file.name,
      size: file.size,
      status: "ready",
      transactionCount: valid.length,
    });

    for (const t of valid) t.sourceFileId = fileRecord._id;
    await Transaction.insertMany(valid);

    await invalidateAnalyticsCache(businessId);
    analyzeBusiness(businessId).catch(() => {});

    return json({
      file: { id: fileRecord._id, filename: file.name },
      quality: {
        processed: raw.length,
        imported: valid.length,
        duplicates,
        existingDuplicates,
        repaired,
        warnings,
      },
      summary,
      preview: valid.slice(0, 10).map((t) => ({
        date: t.date,
        amount: t.amount,
        direction: t.direction,
        description: t.description,
        category: t.category,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
