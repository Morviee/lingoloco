import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '../../../lib/mongodb';
import User from '../../../models/User';
import { authOptions } from '../auth/[...nextauth]/route';
import { applyPracticeCompletion, buildProgressSummary, type ProgressSnapshot } from '../../../lib/progress';

export const dynamic = 'force-dynamic';

type ProgressRequestBody = {
  sessionMinutes?: number;
  xpEarned?: number;
  score?: number;
  totalQuestions?: number;
  sessionId?: number;
  setId?: number;
  sessionLabel?: string;
  setLabel?: string;
  totalSessions?: number;
  setsPerSession?: number;
};

function calculateXpEarned(body: ProgressRequestBody) {
  if (typeof body.xpEarned === 'number' && Number.isFinite(body.xpEarned)) {
    return Math.max(0, Math.round(body.xpEarned));
  }

  const score = Math.max(0, Math.round(body.score ?? 0));
  const totalQuestions = Math.max(1, Math.round(body.totalQuestions ?? 10));
  const completionRatio = Math.min(1, score / totalQuestions);
  const baseXp = 10 + Math.round(completionRatio * 30);
  const perfectBonus = score === totalQuestions ? 10 : 0;

  return baseXp + perfectBonus;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    await dbConnect();

    const userData = await User.findOne({ email: session.user.email }).lean();

    if (!userData) {
      return NextResponse.json({ success: false, error: 'User profile not found in database.' }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, data: { ...userData, progressSummary: buildProgressSummary(userData as ProgressSnapshot) } },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: any) {
    console.error('API Error fetching progress:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch progress: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const body = (await request.json()) as ProgressRequestBody;
    await dbConnect();

    const user = await User.findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User profile not found in database.' }, { status: 404 });
    }

    const updates = applyPracticeCompletion(user.toObject() as ProgressSnapshot, {
      sessionMinutes: Number.isFinite(body.sessionMinutes ?? NaN) ? Number(body.sessionMinutes) : 10,
      xpEarned: calculateXpEarned(body),
      sessionId: Number.isFinite(body.sessionId ?? NaN) ? Number(body.sessionId) : 1,
      setId: Number.isFinite(body.setId ?? NaN) ? Number(body.setId) : 1,
      sessionLabel: body.sessionLabel,
      setLabel: body.setLabel,
      totalSessions: Number.isFinite(body.totalSessions ?? NaN) ? Number(body.totalSessions) : 10,
      setsPerSession: Number.isFinite(body.setsPerSession ?? NaN) ? Number(body.setsPerSession) : 7,
    });

    user.xp = updates.xp;
    user.streak = updates.streak;
    user.dailyProgressMinutes = updates.dailyProgressMinutes;
    user.dailyXpToday = updates.dailyXpToday;
    user.dailyScenariosToday = updates.dailyScenariosToday;
    user.lessonsCompleted = updates.lessonsCompleted;
    user.totalTimeHours = updates.totalTimeHours;
    user.lastPracticeDateKey = updates.lastPracticeDateKey;
    user.lastPracticeAt = updates.lastPracticeAt;

    await user.save();

    const savedUser = user.toObject() as ProgressSnapshot;

    return NextResponse.json(
      { success: true, data: { ...savedUser, progressSummary: buildProgressSummary(savedUser) } },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: any) {
    console.error('API Error saving progress:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save progress: ' + error.message },
      { status: 500 }
    );
  }
}
