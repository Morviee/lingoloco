import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose from 'mongoose';
import dbConnect from '../../../../lib/mongodb';
import User from '../../../../models/User';
import { authOptions } from '../../auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';

type DuelApiBody = {
  action?: 'send' | 'accept' | 'decline';
  targetEmail?: string;
  notificationId?: string;
};

type NotificationPayload = {
  id: string;
  senderEmail: string;
  senderName: string;
  senderImage: string;
  senderTargetLanguage: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  respondedAt: string | null;
};

function noCacheHeaders() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  };
}

function normalizeNotifications(notifications: unknown): NotificationPayload[] {
  if (!Array.isArray(notifications)) {
    return [];
  }

  return notifications
    .map((item) => {
      const raw = (item ?? {}) as Record<string, unknown>;
      const createdAt = raw.createdAt ? new Date(String(raw.createdAt)) : new Date();
      const respondedAt = raw.respondedAt ? new Date(String(raw.respondedAt)) : null;

      return {
        id: String(raw.id ?? ''),
        senderEmail: String(raw.senderEmail ?? ''),
        senderName: String(raw.senderName ?? 'Unknown learner'),
        senderImage: String(raw.senderImage ?? ''),
        senderTargetLanguage: String(raw.senderTargetLanguage ?? ''),
        status: (raw.status === 'accepted' || raw.status === 'declined' ? raw.status : 'pending') as 'pending' | 'accepted' | 'declined',
        createdAt: createdAt.toISOString(),
        respondedAt: respondedAt ? respondedAt.toISOString() : null,
      };
    })
    .filter((item) => item.id && item.senderEmail)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401, headers: noCacheHeaders() });
    }

    await dbConnect();

    const currentUser = await User.findOne({ email: session.user.email })
      .select('name email image targetLanguage duelNotifications')
      .lean<{
        name?: string;
        email?: string;
        image?: string;
        targetLanguage?: string;
        duelNotifications?: unknown;
      }>();

    if (!currentUser?.email) {
      return NextResponse.json({ success: false, error: 'User profile not found.' }, { status: 404, headers: noCacheHeaders() });
    }

    const rivals = await User.find({ email: { $ne: currentUser.email } })
      .sort({ xp: -1, updatedAt: -1 })
      .limit(20)
      .select('name email image targetLanguage level xp')
      .lean<Array<{
        _id: { toString(): string };
        name?: string;
        email?: string;
        image?: string;
        targetLanguage?: string;
        level?: string;
        xp?: number;
      }>>();

    const rivalCards = rivals
      .filter((rival) => Boolean(rival.email))
      .map((rival) => ({
        id: rival._id.toString(),
        name: rival.name || 'Learner',
        email: rival.email as string,
        bio: `Practicing ${String(rival.targetLanguage || 'languages').toUpperCase()} at ${rival.level || 'Beginner'} level.`,
        rank: rival.level || 'Beginner',
        xp: Number(rival.xp || 0),
        lang: String(rival.targetLanguage || 'N/A').toUpperCase(),
        avatar: (rival.name || 'L').trim().charAt(0).toUpperCase() || 'L',
        image: rival.image || '',
      }));

    const notifications = normalizeNotifications(currentUser.duelNotifications);

    return NextResponse.json(
      {
        success: true,
        data: {
          rivals: rivalCards,
          notifications,
        },
      },
      { status: 200, headers: noCacheHeaders() }
    );
  } catch (error: any) {
    console.error('Compete duels GET error:', error);
    return NextResponse.json(
      { success: false, error: `Failed to load duel data: ${error.message}` },
      { status: 500, headers: noCacheHeaders() }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401, headers: noCacheHeaders() });
    }

    const body = (await request.json()) as DuelApiBody;
    const action = body.action;

    if (!action) {
      return NextResponse.json({ success: false, error: 'Action is required.' }, { status: 400, headers: noCacheHeaders() });
    }

    await dbConnect();

    const currentUser = await User.findOne({ email: session.user.email });
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User profile not found.' }, { status: 404, headers: noCacheHeaders() });
    }

    if (action === 'send') {
      const targetEmail = String(body.targetEmail || '').trim().toLowerCase();
      if (!targetEmail) {
        return NextResponse.json({ success: false, error: 'targetEmail is required.' }, { status: 400, headers: noCacheHeaders() });
      }

      if (targetEmail === currentUser.email.toLowerCase()) {
        return NextResponse.json({ success: false, error: 'You cannot challenge yourself.' }, { status: 400, headers: noCacheHeaders() });
      }

      const targetUser = await User.findOne({ email: targetEmail });
      if (!targetUser) {
        return NextResponse.json(
          { success: false, error: 'Target learner was not found. Ask them to sign in once first.' },
          { status: 404, headers: noCacheHeaders() }
        );
      }

      const existingPending = (targetUser.duelNotifications || []).find(
        (item) => item.senderEmail === currentUser.email && item.status === 'pending'
      );

      if (!existingPending) {
        targetUser.duelNotifications = targetUser.duelNotifications || [];
        targetUser.duelNotifications.unshift({
          id: new mongoose.Types.ObjectId().toString(),
          senderEmail: currentUser.email,
          senderName: currentUser.name || 'Language Learner',
          senderImage: currentUser.image || '',
          senderTargetLanguage: currentUser.targetLanguage || '',
          status: 'pending',
          createdAt: new Date(),
        });
        await targetUser.save();
      }

      return NextResponse.json(
        {
          success: true,
          message: existingPending ? 'Challenge already pending for this learner.' : 'Challenge sent. Waiting for acceptance.',
        },
        { status: 200, headers: noCacheHeaders() }
      );
    }

    if (action === 'accept' || action === 'decline') {
      const notificationId = String(body.notificationId || '').trim();

      if (!notificationId) {
        return NextResponse.json({ success: false, error: 'notificationId is required.' }, { status: 400, headers: noCacheHeaders() });
      }

      const notification = (currentUser.duelNotifications || []).find((item) => item.id === notificationId);
      if (!notification) {
        return NextResponse.json({ success: false, error: 'Notification not found.' }, { status: 404, headers: noCacheHeaders() });
      }

      if (notification.status !== 'pending') {
        return NextResponse.json(
          { success: true, message: `This request was already ${notification.status}.` },
          { status: 200, headers: noCacheHeaders() }
        );
      }

      notification.status = action === 'accept' ? 'accepted' : 'declined';
      notification.respondedAt = new Date();
      await currentUser.save();

      return NextResponse.json(
        {
          success: true,
          message: action === 'accept' ? 'Duel request accepted.' : 'Duel request declined.',
        },
        { status: 200, headers: noCacheHeaders() }
      );
    }

    return NextResponse.json({ success: false, error: 'Unsupported action.' }, { status: 400, headers: noCacheHeaders() });
  } catch (error: any) {
    console.error('Compete duels POST error:', error);
    return NextResponse.json(
      { success: false, error: `Failed to update duel request: ${error.message}` },
      { status: 500, headers: noCacheHeaders() }
    );
  }
}
