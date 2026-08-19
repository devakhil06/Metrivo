import mongoose, { Schema, models, model } from "mongoose";

export interface IUser {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const User = models.User || model<IUser>("User", UserSchema);

export interface IBusiness {
  _id: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  name: string;
  businessType: string;
  industry: string;
  currency: string;
  country: string;
  revenueModel: string;
  startDate?: string;
  inputs?: Record<string, number>;
  createdAt: Date;
}

const BusinessSchema = new Schema<IBusiness>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    name: { type: String, required: true, trim: true },
    businessType: { type: String, default: "retail" },
    industry: { type: String, default: "general" },
    currency: { type: String, default: "INR" },
    country: { type: String, default: "India" },
    revenueModel: { type: String, default: "product_sales" },
    startDate: { type: String },
    inputs: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const Business = models.Business || model<IBusiness>("Business", BusinessSchema);

export interface IFile {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  filename: string;
  size: number;
  status: "ready" | "error";
  transactionCount: number;
  error?: string;
  createdAt: Date;
}

const FileSchema = new Schema<IFile>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    filename: { type: String, required: true },
    size: { type: Number, required: true },
    status: { type: String, enum: ["ready", "error"], default: "ready" },
    transactionCount: { type: Number, default: 0 },
    error: { type: String },
  },
  { timestamps: true }
);

export const FileModel = models.File || model<IFile>("File", FileSchema);

export interface ITransaction {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  sourceFileId?: mongoose.Types.ObjectId;
  date: Date;
  amount: number;
  direction: "credit" | "debit";
  rawType?: string;
  description: string;
  merchant?: string;
  category: string;
  subcategory: string;
  paymentMethod?: string;
  currency: string;
  confidence: number;
  dedupKey?: string;
  createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    sourceFileId: { type: Schema.Types.ObjectId, ref: "File" },
    date: { type: Date, required: true },
    amount: { type: Number, required: true },
    direction: { type: String, enum: ["credit", "debit"], required: true },
    rawType: { type: String },
    description: { type: String, default: "" },
    merchant: { type: String },
    category: { type: String, default: "unknown" },
    subcategory: { type: String, default: "other" },
    paymentMethod: { type: String },
    currency: { type: String, default: "INR" },
    confidence: { type: Number, default: 0.5 },
    dedupKey: { type: String },
  },
  { timestamps: true }
);

TransactionSchema.index({ businessId: 1, date: 1 });
TransactionSchema.index({ businessId: 1, category: 1 });
TransactionSchema.index({ businessId: 1, direction: 1 });
TransactionSchema.index(
  { businessId: 1, dedupKey: 1 },
  { unique: true, partialFilterExpression: { dedupKey: { $type: "string" } } }
);

export const Transaction =
  models.Transaction || model<ITransaction>("Transaction", TransactionSchema);

export interface IConversation {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  title: string;
  createdAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    title: { type: String, default: "New conversation" },
  },
  { timestamps: true }
);

export const Conversation =
  models.Conversation || model<IConversation>("Conversation", ConversationSchema);

export interface IMessage {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

export const Message = models.Message || model<IMessage>("Message", MessageSchema);

export interface IRefreshSession {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  lastUsedAt: Date;
  revokedAt?: Date;
  replacedByHash?: string;
  createdAt: Date;
}

const RefreshSessionSchema = new Schema<IRefreshSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    familyId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, required: true },
    revokedAt: { type: Date },
    replacedByHash: { type: String },
  },
  { timestamps: true }
);

RefreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshSession =
  models.RefreshSession || model<IRefreshSession>("RefreshSession", RefreshSessionSchema);

export interface IRateLimit {
  key: string;
  count: number;
  expiresAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);

RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit = models.RateLimit || model<IRateLimit>("RateLimit", RateLimitSchema);
