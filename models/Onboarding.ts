import mongoose, { Schema, Document } from 'mongoose';

export interface IOnboarding extends Document {
  courseId: string;
  level: string;
  commitment: number;
  remindersEnabled: boolean;
  reminderTime: string;
  createdAt: Date;
}

const OnboardingSchema: Schema = new Schema({
  courseId: { type: String, required: true },
  level: { type: String, required: true },
  commitment: { type: Number, required: true },
  remindersEnabled: { type: Boolean, required: true },
  reminderTime: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Onboarding || mongoose.model<IOnboarding>('Onboarding', OnboardingSchema);
