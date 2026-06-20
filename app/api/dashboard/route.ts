import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '../../../lib/mongodb';
import User from '../../../models/User';
import { authOptions } from '../auth/[...nextauth]/route';
import { buildProgressSummary, type ProgressSnapshot } from '../../../lib/progress';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    await dbConnect();

    // Fetch full user data matching the session
    const userData = await User.findOne({ email: session.user.email }).lean();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: "User profile not found in database." },
        { status: 404 }
      );
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
    console.error("API Error fetching dashboard data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch dashboard data: " + error.message },
      { status: 500 }
    );
  }
}
