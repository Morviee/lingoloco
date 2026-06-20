import mongoose, { Schema, Document, Model } from 'mongoose';

export type DuelNotificationStatus = 'pending' | 'accepted' | 'declined';

export interface IDuelNotification {
  id: string;
  senderEmail: string;
  senderName: string;
  senderImage?: string;
  senderTargetLanguage?: string;
  status: DuelNotificationStatus;
  createdAt: Date;
  respondedAt?: Date | null;
}

export interface IUser extends Document {
  name: string;
  email: string;
  image?: string;
  targetLanguage: string;
  level: string;
  
  // Gamification Metrics
  xp: number;
  streak: number;
  dailyGoalMinutes: number;
  dailyProgressMinutes: number;
  dailyXpToday: number;
  dailyScenariosToday: number;
  lessonsCompleted: number;
  totalTimeHours: number;
  lastPracticeDateKey?: string;
  lastPracticeAt?: Date;
  practiceCompletedSetKeys: string[];
  practiceCompletedSessionIds: number[];
  lastPracticeSessionId?: number;
  lastPracticeSetId?: number;
  lastPracticeSessionLabel?: string;
  lastPracticeSetLabel?: string;
  squadId?: number;
  squadJoinedAt?: Date;
  duelNotifications: IDuelNotification[];
  
  createdAt: Date;
  updatedAt: Date;
}

const DuelNotificationSchema = new Schema<IDuelNotification>(
  {
    id: { type: String, required: true },
    senderEmail: { type: String, required: true },
    senderName: { type: String, required: true },
    senderImage: { type: String, default: '' },
    senderTargetLanguage: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
    },
    createdAt: { type: Date, default: Date.now },
    respondedAt: { type: Date, default: null },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  image: { type: String },
  targetLanguage: { type: String, default: 'es' },
  level: { type: String, default: 'Beginner' },

  // Gamification Metrics initialized with placeholders for Dashboard logic
  xp: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  dailyGoalMinutes: { type: Number, default: 10 },
  dailyProgressMinutes: { type: Number, default: 0 },
  dailyXpToday: { type: Number, default: 0 },
  dailyScenariosToday: { type: Number, default: 0 },
  lessonsCompleted: { type: Number, default: 0 },
  totalTimeHours: { type: Number, default: 0 },
  lastPracticeDateKey: { type: String, default: '' },
  lastPracticeAt: { type: Date, default: null },
  practiceCompletedSetKeys: { type: [String], default: [] },
  practiceCompletedSessionIds: { type: [Number], default: [] },
  lastPracticeSessionId: { type: Number, default: null },
  lastPracticeSetId: { type: Number, default: null },
  lastPracticeSessionLabel: { type: String, default: '' },
  lastPracticeSetLabel: { type: String, default: '' },
  squadId: { type: Number, default: null },
  squadJoinedAt: { type: Date, default: null },
  duelNotifications: { type: [DuelNotificationSchema], default: [] },
}, { timestamps: true });

// Avoid Next.js HMR model recompilation errors
const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
