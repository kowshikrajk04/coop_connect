import io
import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
import models
from auth_utils import get_current_user_optional
from services.ai_evaluator import evaluate_worker_assessment_answer
from ml.assessment_data import get_trade_assessment_questions

router = APIRouter(prefix="/api/assessment", tags=["assessment"])


class AssessmentEvaluateRequest(BaseModel):
    skill: str
    question: str
    selected_language: str = "en"
    transcribed_answer: str = ""
    question_id: Optional[str] = None
    question_number: Optional[int] = None


class AssessmentEvaluateResponse(BaseModel):
    score: float
    correctness: str
    feedback: str
    safety_awareness: str
    practical_knowledge: str
    ai_configured: Optional[bool] = False
    notice: Optional[str] = None
    evaluator: Optional[str] = None


class QuestionDossierItem(BaseModel):
    question_id: Optional[str] = None
    question_number: Optional[int] = None
    question: str
    transcribed_answer: str = ""
    score: float = 0.0
    AI_feedback: Optional[str] = None
    correctness: Optional[str] = None
    safety_awareness: Optional[str] = None


class AssessmentSubmitPayload(BaseModel):
    skill: str
    preferred_language: str = "en"
    total_score: float
    average_score: Optional[float] = None
    percentage: float
    passed: bool
    transcribed_answers: Optional[List[QuestionDossierItem]] = None
    all_transcripts: Optional[str] = None
    evaluation_summary: Optional[str] = None
    worker_id: Optional[int] = None


@router.get("/questions")
def get_assessment_questions(
    skill: str = "Plumber", 
    lang: Optional[str] = None, 
    language: Optional[str] = None
):
    """
    Returns 10 practical scenario questions for the trade in the selected language.
    """
    chosen_lang = lang or language or "ta"
    questions = get_trade_assessment_questions(skill_name=skill, language=chosen_lang)
    return {
        "skill": skill,
        "language": chosen_lang,
        "count": len(questions),
        "questions": questions
    }


@router.get("/tts")
async def stream_tts_audio(text: str, lang: str = "ta"):
    """
    Streams neural TTS audio for the given question or feedback.
    Provides crystal-clear, authentic spoken audio in Tamil, English, Hindi, etc.
    even on Windows/Linux environments lacking native OS speech packs.
    """
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Text parameter is required")

    voice_map = {
        "ta": "ta-IN-PallaviNeural",
        "en": "en-IN-NeerjaNeural",
        "hi": "hi-IN-SwaraNeural",
        "te": "te-IN-ShrutiNeural",
        "kn": "kn-IN-SapnaNeural",
        "ml": "ml-IN-SobhanaNeural",
        "bn": "bn-IN-TanishaaNeural",
        "mr": "mr-IN-AarohiNeural"
    }

    clean_lang = lang.lower()[:2]
    voice = voice_map.get(clean_lang, "ta-IN-PallaviNeural" if clean_lang == "ta" else "en-IN-NeerjaNeural")

    # 1. High-fidelity Neural TTS via edge-tts
    try:
        import edge_tts
        communicate = edge_tts.Communicate(text.strip(), voice)
        audio_stream = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_stream.write(chunk["data"])
        audio_stream.seek(0)
        audio_bytes = audio_stream.read()
        if len(audio_bytes) > 0:
            return Response(
                content=audio_bytes, 
                media_type="audio/mpeg", 
                headers={"Cache-Control": "public, max-age=86400"}
            )
    except Exception as e:
        print(f"edge-tts warning: {e}, falling back to gTTS")

    # 2. Resilient fallback via gTTS
    try:
        from gtts import gTTS
        fp = io.BytesIO()
        gtts_lang = "ta" if clean_lang == "ta" else ("hi" if clean_lang == "hi" else "en")
        tts_obj = gTTS(text=text.strip(), lang=gtts_lang)
        tts_obj.write_to_fp(fp)
        fp.seek(0)
        return Response(
            content=fp.read(), 
            media_type="audio/mpeg", 
            headers={"Cache-Control": "public, max-age=86400"}
        )
    except Exception as e2:
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {str(e2)}")


@router.post("/evaluate", response_model=AssessmentEvaluateResponse)
def evaluate_single_answer(payload: AssessmentEvaluateRequest):
    """
    Evaluates a worker's spoken practical answer semantically.
    Returns score (0-10), correctness, feedback in chosen language,
    safety awareness, and practical knowledge assessment.
    """
    result = evaluate_worker_assessment_answer(
        skill=payload.skill,
        question=payload.question,
        selected_language=payload.selected_language,
        transcribed_answer=payload.transcribed_answer,
        question_id=payload.question_id,
        question_number=payload.question_number
    )
    return AssessmentEvaluateResponse(**result)


@router.post("/submit")
def submit_complete_assessment(
    payload: AssessmentSubmitPayload,
    user: Optional[models.User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Saves complete 10-question assessment dossier to database.
    Status set to PENDING_APPROVAL for Cooperative Board review.
    Does NOT automatically verify the worker.
    """
    worker = None
    if user and user.worker:
        worker = user.worker
    elif payload.worker_id:
        worker = db.query(models.Worker).filter(models.Worker.id == payload.worker_id).first()
    
    # If no worker is linked yet (e.g. anonymous test run), find the latest pending worker or create detached record
    target_worker_id = worker.id if worker else None
    if not target_worker_id:
        latest_worker = db.query(models.Worker).order_by(models.Worker.id.desc()).first()
        if latest_worker:
            target_worker_id = latest_worker.id

    import json
    answers_json_str = None
    if payload.transcribed_answers:
        answers_json_str = json.dumps([item.dict() for item in payload.transcribed_answers], ensure_ascii=False)

    summary = (
        payload.evaluation_summary 
        or f"{payload.skill} Voice Assessment ({payload.preferred_language.upper()}) completed. Score: {payload.percentage}%. Status: PENDING_APPROVAL."
    )

    assessment = models.SkillAssessment(
        worker_id=target_worker_id or 1,
        skill_name=payload.skill,
        score=payload.percentage,
        passed=payload.passed,
        language=payload.preferred_language,
        answers_json=answers_json_str,
        voice_transcript=payload.all_transcripts or "10 practical scenario questions answered via voice.",
        evaluation_summary=summary,
        status="PENDING_APPROVAL",
        assessment_date=datetime.datetime.utcnow()
    )
    db.add(assessment)

    if worker:
        # Check skill entry
        existing_skill = db.query(models.WorkerSkill).filter(
            models.WorkerSkill.worker_id == worker.id,
            models.WorkerSkill.skill_name == payload.skill
        ).first()
        if not existing_skill:
            db.add(models.WorkerSkill(worker_id=worker.id, skill_name=payload.skill, years_experience=2))

        worker.status = "PENDING_VERIFICATION"

    db.commit()

    return {
        "success": True,
        "message": "Skill assessment submitted successfully. Pending Cooperative Board Review.",
        "skill": payload.skill,
        "score": payload.percentage,
        "passed": payload.passed,
        "status": "PENDING_APPROVAL"
    }
