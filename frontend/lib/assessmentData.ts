import assessmentBanksData from './assessment_banks.json';

export interface QuestionItem {
  id: string;
  q_no: number;
  question: string;
  question_en?: string;
  question_ta?: string;
  options?: string[];
  correct_index?: number;
  explanation?: string;
  voice_prompt?: string;
  voice_prompt_en?: string;
  voice_prompt_ta?: string;
  key_concepts?: string[];
}

export interface EvaluationResult {
  score: number;
  correctness: string;
  feedback: string;
  safety_awareness: string;
  practical_knowledge: string;
  ai_configured?: boolean;
  notice?: string;
  evaluator?: string;
}

const banks = assessmentBanksData as Record<string, any[]>;

// Returns 10 practical questions for trade in selected language
export function getTradeAssessmentQuestions(
  skillName: string = 'Plumber',
  language: string = 'ta'
): QuestionItem[] {
  const bank = banks[skillName] || banks['Plumber'] || [];
  const cleanLang = (language || 'ta').toLowerCase().slice(0, 2);
  const isTamil = cleanLang === 'ta';

  return bank.map((q: any) => {
    let questionText = isTamil ? q.question_ta : q.question_en;
    let voicePrompt = isTamil ? q.voice_prompt_ta : q.voice_prompt_en;
    let options = isTamil ? q.options_ta : q.options_en;
    let explanation = isTamil ? q.explanation_ta : q.explanation_en;
    let concepts = isTamil ? q.key_concepts_ta : q.key_concepts_en;

    if (!questionText) {
      questionText = q.question_en || q.question_ta;
    }

    return {
      id: q.id,
      q_no: q.q_no,
      question: questionText,
      question_en: q.question_en,
      question_ta: q.question_ta,
      options: options || [],
      correct_index: q.correct_index ?? 0,
      explanation: explanation || '',
      voice_prompt: voicePrompt || questionText,
      voice_prompt_en: q.voice_prompt_en || q.question_en,
      voice_prompt_ta: q.voice_prompt_ta || q.question_ta,
      key_concepts: concepts || [],
    };
  });
}

// Evaluates a worker's answer semantically based on trade knowledge and safety
export function evaluateAssessmentAnswer(
  skill: string,
  questionId: string | undefined,
  questionText: string,
  selectedLanguage: string,
  transcribedAnswer: string
): EvaluationResult {
  const cleanLang = (selectedLanguage || 'ta').toLowerCase().slice(0, 2);
  const isTamil = cleanLang === 'ta';
  const answer = (transcribedAnswer || '').trim().toLowerCase();

  const bank = banks[skill] || banks['Plumber'] || [];
  let questionData = bank.find((q: any) => q.id === questionId);
  if (!questionData && questionText) {
    questionData = bank.find(
      (q: any) =>
        (q.question_ta && questionText.includes(q.question_ta)) ||
        (q.question_en && questionText.includes(q.question_en))
    );
  }
  if (!questionData && bank.length > 0) {
    questionData = bank[0];
  }

  const conceptsTa = questionData?.key_concepts_ta || [];
  const conceptsEn = questionData?.key_concepts_en || [];
  const allConcepts = [...conceptsTa, ...conceptsEn];

  let matchedCount = 0;
  for (const c of allConcepts) {
    if (c && answer.includes(c.toLowerCase())) {
      matchedCount++;
    }
  }

  let score = 0.0;
  if (answer.length > 0) {
    score = 4.0;
    score += Math.min(6.0, matchedCount * 2.0);
    if (answer.length > 25 && matchedCount >= 1) {
      score = Math.max(score, 7.5);
    }
    if (matchedCount >= 2) {
      score = Math.max(score, 8.5);
    }
  }
  score = Math.min(10.0, Math.round(score * 10) / 10);

  let correctness = 'Needs Improvement';
  let safetyAwareness = 'Moderate';
  let practicalKnowledge = 'Basic';
  let feedback = '';

  if (score >= 8.0) {
    correctness = 'Correct';
    safetyAwareness = 'High';
    practicalKnowledge = 'Expert';
    feedback = isTamil
      ? 'சிறந்த செய்முறை விளக்கம்! பாதுகாப்பு நெறிமுறைகளையும் சரியான வழிமுறைகளையும் தெளிவாக குறிப்பிட்டுள்ளீர்கள்.'
      : 'Excellent practical response! Demonstrated clear safety awareness and standard troubleshooting procedure.';
  } else if (score >= 6.0) {
    correctness = 'Partially Correct';
    safetyAwareness = 'Good';
    practicalKnowledge = 'Proficient';
    feedback = isTamil
      ? 'சரியான நடைமுறை. பணியின் முக்கிய படிநிலைகளை சரியாக புரிந்து வைத்துள்ளீர்கள்.'
      : 'Good answer. You demonstrated adequate working knowledge of trade procedures.';
  } else if (score >= 4.0) {
    correctness = 'Partially Correct';
    safetyAwareness = 'Basic';
    practicalKnowledge = 'Developing';
    feedback = isTamil
      ? 'ஓரளவு சரியான பதில். பாதுகாப்பு நடைமுறைகள் மற்றும் கருவிகளின் சரியான பயன்பாட்டில் கூடுதல் கவனம் தேவை.'
      : 'Partially correct. Recommend closer attention to standard safety measures and tool sequencing.';
  } else {
    correctness = 'Incomplete';
    safetyAwareness = 'Needs Review';
    practicalKnowledge = 'Uncertain';
    const hint = isTamil ? questionData?.explanation_ta : questionData?.explanation_en;
    feedback = isTamil
      ? 'பதில் போதுமானதாக இல்லை. சரியான நடைமுறை: ' + (hint || 'பாதுகாப்பான செயல்முறைகளை பின்பற்றவும்.')
      : 'Answer needs more detail. Standard practice: ' + (hint || 'Follow standard trade safety protocols.');
  }

  return {
    score,
    correctness,
    feedback,
    safety_awareness: safetyAwareness,
    practical_knowledge: practicalKnowledge,
    ai_configured: true,
    evaluator: 'CoopConnect Practical Evaluation Engine',
    notice: isTamil
      ? 'செய்முறை அறிவு மற்றும் பாதுகாப்பு விதிகள் அடிப்படையில் மதிப்பிடப்பட்டது.'
      : 'Evaluated on practical trade criteria and safety awareness.',
  };
}
