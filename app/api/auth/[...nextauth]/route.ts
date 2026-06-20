import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/User";

type SessionToken = JWT & {
  userId?: string;
  targetLanguage?: string;
};

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string || "dummy_client_id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string || "dummy_client_secret",
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      console.log("SignIn Callback Triggered:", user.email);
      if (!user.email) {
        console.error("No email provided by OAuth!");
        return false;
      }
      
      try {
        await dbConnect();
        
        // Find existing user or create a new one to sync Google OAuth with MongoDB Gamification Schema
        const existingUser = await User.findOne({ email: user.email });
        
        if (!existingUser) {
          console.log("Creating new user for:", user.email);
          await User.create({
            name: user.name || "Language Learner",
            email: user.email,
            image: user.image,
            targetLanguage: 'es', // Default, would be overwritten by onboarding later
            level: 'Beginner',
            xp: 0,
            streak: 0,
            dailyGoalMinutes: 10,
            dailyProgressMinutes: 0,
            dailyXpToday: 0,
            dailyScenariosToday: 0,
            lessonsCompleted: 0,
            totalTimeHours: 0,
            lastPracticeDateKey: '',
            lastPracticeAt: null,
            practiceCompletedSetKeys: [],
            practiceCompletedSessionIds: [],
            lastPracticeSessionId: null,
            lastPracticeSetId: null,
            lastPracticeSessionLabel: '',
            lastPracticeSetLabel: '',
            squadId: null,
            squadJoinedAt: null,
            duelNotifications: [],
          });
        } else {
          console.log("Existing user found for:", user.email, "Updating...");
          // Optionally update picture or name if changed on Google
          existingUser.name = user.name || existingUser.name;
          if (user.image && user.image !== existingUser.image) {
            existingUser.image = user.image;
          }
          await existingUser.save();
          console.log("User updated successfully");
        }

        return true;
      } catch (error) {
        console.error("Error saving user during sign in:", error);
        return false;
      }
    },
    async jwt({ token, user }) {
      if (!user?.email) {
        return token;
      }

      try {
        await dbConnect();
        const dbUser = await User.findOne({ email: user.email }).lean<{
          _id: { toString(): string };
          targetLanguage: string;
        }>();

        if (dbUser) {
          const typedToken = token as SessionToken;
          typedToken.userId = dbUser._id.toString();
          typedToken.targetLanguage = dbUser.targetLanguage;
        }
      } catch (error) {
        console.error("Error setting JWT session fields:", error);
      }
      return token;
    },
    async session({ session, token }) {
      const typedToken = token as SessionToken;
      const typedSession = session as typeof session & {
        userId?: string;
        targetLanguage?: string;
      };

      typedSession.userId = typedToken.userId;
      typedSession.targetLanguage = typedToken.targetLanguage || 'es';
      return typedSession;
    }
  },
  pages: {
    signIn: '/login',
    error: '/login', // Redirect back to login on error (to show next-auth default errors quietly if needed)
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback_development_secret_only",
  session: {
    strategy: "jwt",
  },
  debug: true,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
