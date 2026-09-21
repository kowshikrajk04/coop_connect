import { NextRequest, NextResponse } from 'next/server';
import { getTradeAssessmentQuestions } from '@/lib/assessmentData';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const skill = searchParams.get('skill') || 'Plumber';
    const lang = searchParams.get('lang') || searchParams.get('language') || 'ta';

    const questions = getTradeAssessmentQuestions(skill, lang);
    return NextResponse.json({
      skill,
      language: lang,
      count: questions.length,
      questions,
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || 'Failed to retrieve assessment questions' },
      { status: 500 }
    );
  }
}
