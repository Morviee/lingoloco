import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Onboarding from '../../../models/Onboarding';

export async function POST(request: Request) {
  try {
    // Await the connection directly from the exported promise
    await dbConnect();

    // Parse the incoming JSON body from the frontend
    const body = await request.json();

    // Save to database
    const newOnboarding = await Onboarding.create(body);

    return NextResponse.json(
      { success: true, data: newOnboarding },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("API Error connecting or saving:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process form submission: " + error.message },
      { status: 500 }
    );
  }
}
