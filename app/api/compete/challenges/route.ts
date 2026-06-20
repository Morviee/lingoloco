import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '../../../../lib/mongodb';
import User from '../../../../models/User';
import { authOptions } from '../../auth/[...nextauth]/route';
import { COMPETE_SQUADS, getSquadById } from '../../../../lib/competeSquads';

export const dynamic = 'force-dynamic';

type JoinChallengeRequest = {
  squadId?: number;
};

async function buildSquadPayload(userEmail?: string) {
  await dbConnect();

  const grouped = await User.aggregate<{ _id: number; count: number }>([
    { $match: { squadId: { $in: COMPETE_SQUADS.map((squad) => squad.id) } } },
    { $group: { _id: '$squadId', count: { $sum: 1 } } },
  ]);

  const extraMembersBySquadId = new Map<number, number>(
    grouped
      .filter((item) => Number.isInteger(item._id))
      .map((item) => [item._id, item.count])
  );

  let joinedSquadId: number | null = null;

  if (userEmail) {
    const user = await User.findOne({ email: userEmail }).select('squadId').lean<{ squadId?: number | null }>();
    joinedSquadId = typeof user?.squadId === 'number' ? user.squadId : null;
  }

  const squads = COMPETE_SQUADS.map((squad) => {
    const extraMembers = extraMembersBySquadId.get(squad.id) || 0;
    const members = Math.min(squad.maxMembers, squad.baseMembers + extraMembers);
    const joined = joinedSquadId === squad.id;

    return {
      id: squad.id,
      name: squad.name,
      lang: squad.lang,
      members,
      maxMembers: squad.maxMembers,
      score: squad.score,
      icon: squad.icon,
      joined,
      canJoin: joined || members < squad.maxMembers,
    };
  });

  return {
    squads,
    joinedSquadId,
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    const payload = await buildSquadPayload(userEmail || undefined);

    return NextResponse.json(
      { success: true, data: payload },
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
    console.error('Compete Challenges GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load squads: ' + error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const body = (await request.json()) as JoinChallengeRequest;
    const squadId = Number(body.squadId);

    if (!Number.isFinite(squadId)) {
      return NextResponse.json({ success: false, error: 'A valid squadId is required.' }, { status: 400 });
    }

    const squad = getSquadById(squadId);
    if (!squad) {
      return NextResponse.json({ success: false, error: 'Selected squad does not exist.' }, { status: 404 });
    }

    await dbConnect();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User profile not found.' }, { status: 404 });
    }

    if (user.squadId === squadId) {
      const payload = await buildSquadPayload(session.user.email);
      return NextResponse.json({ success: true, data: payload, message: 'Already joined this squad.' }, { status: 200 });
    }

    const targetCount = await User.countDocuments({ squadId });
    const effectiveMembers = squad.baseMembers + targetCount;

    if (effectiveMembers >= squad.maxMembers) {
      return NextResponse.json({ success: false, error: 'This squad is full. Please pick another one.' }, { status: 409 });
    }

    user.squadId = squadId;
    user.squadJoinedAt = new Date();
    await user.save();

    const payload = await buildSquadPayload(session.user.email);
    return NextResponse.json({ success: true, data: payload, message: `Joined ${squad.name}` }, { status: 200 });
  } catch (error: any) {
    console.error('Compete Challenges POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to join squad: ' + error.message }, { status: 500 });
  }
}
