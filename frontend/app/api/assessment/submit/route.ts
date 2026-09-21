import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return NextResponse.json({
      success: true,
      passed: body.passed ?? (body.percentage >= 60),
      percentage: body.percentage ?? 0,
      status: 'PENDING_APPROVAL',
      message: 'Skill assessment dossier submitted successfully for Cooperative Board Review.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || 'Failed to submit assessment' },
      { status: 500 }
    );
  }
}
