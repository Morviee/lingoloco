import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Onboarding from '../../../../models/Onboarding';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await dbConnect();
    // Fetch the most recently added onboarding profile as a fallback since there's no auth session logic yet.
    const latestProfile = await Onboarding.findOne().sort({ _id: -1 }).lean();

    if (!latestProfile) {
      return NextResponse.json({ success: false, error: "No user profile found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: latestProfile }, { status: 200 });
  } catch (error: any) {
    console.error("API Error fetching user profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch profile: " + error.message },
      { status: 500 }
    );
  }
}
