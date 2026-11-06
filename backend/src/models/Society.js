import mongoose from 'mongoose';

/**
 * Society Model
 * Represents a single Resident Welfare Association or apartment community.
 * All financial, user, and governance records are scoped to a society.
 */
const societySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Society name is required'],
      trim: true,
      maxlength: [200, 'Society name cannot exceed 200 characters'],
    },
    code: {
      type: String,
      required: [true, 'Society invitation code is required'],
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9-]{4,20}$/, 'Society code must be 4-20 alphanumeric characters'],
    },
    registrationNumber: {
      type: String,
      trim: true,
      default: null,
    },
    address: {
      street: { type: String, trim: true, default: null },
      city: { type: String, trim: true, default: null },
      state: { type: String, trim: true, default: null },
      pincode: { type: String, trim: true, default: null },
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    contactPhone: {
      type: String,
      trim: true,
      default: null,
    },
    fiscalYearStartMonth: {
      // 1 = January, 4 = April (Indian financial year)
      type: Number,
      min: 1,
      max: 12,
      default: 4,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Stores references to committee members (populated from User)
    committeeMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

societySchema.index({ code: 1 }, { unique: true });
societySchema.index({ isActive: 1 });

const Society = mongoose.model('Society', societySchema);
export default Society;
