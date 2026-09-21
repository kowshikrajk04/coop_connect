import { NextRequest, NextResponse } from 'next/server';
import { evaluateAssessmentAnswer } from '@/lib/assessmentData';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const skill = body.skill || 'Plumber';
    const question_id = body.question_id || body.questionId;
    const question = body.question || '';
    const selected_language = body.selected_language || body.language || 'ta';
    const transcribed_answer = body.transcribed_answer || body.answer || '';

    const evaluation = evaluateAssessmentAnswer(
      skill,
      question_id,
      question,
      selected_language,
      transcribed_answer
    );

    return NextResponse.json(evaluation);
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || 'Failed to evaluate answer' },
      { status: 500 }
    );
  }
}
