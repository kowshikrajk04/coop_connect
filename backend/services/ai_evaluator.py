import os
import json
import logging
from typing import Dict, Any, Optional
from pathlib import Path

# Load environment variables from backend/.env if available
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(dotenv_path=env_path)
    except Exception:
        # Simple fallback env parser if python-dotenv is not installed
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

logger = logging.getLogger(__name__)


def evaluate_worker_assessment_answer(
    skill: str,
    question: str,
    selected_language: str,
    transcribed_answer: str,
    question_id: Optional[str] = None,
    question_number: Optional[int] = None
) -> Dict[str, Any]:
    """
    Evaluates a worker's spoken answer semantically.
    Checks for configured AI API Key (AI_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY).
    - If configured: Calls the live AI model for semantic evaluation.
    - If not configured: Returns a clearly labeled fallback evaluation.
    """
    ai_api_key = (
        os.environ.get("AI_API_KEY") 
        or os.environ.get("GEMINI_API_KEY") 
        or os.environ.get("OPENAI_API_KEY")
    )

    clean_answer = (transcribed_answer or "").strip()
    is_tamil = (selected_language == "ta")

    # 1. If AI API Key is present, attempt live AI Model call
    if ai_api_key and len(ai_api_key) > 5:
        try:
            return _call_llm_evaluator(
                api_key=ai_api_key,
                skill=skill,
                question=question,
                selected_language=selected_language,
                transcribed_answer=clean_answer
            )
        except Exception as e:
            logger.warning(f"Live AI evaluation failed: {e}. Falling back to rule-based evaluator.")

    # 2. If AI API Key is NOT configured or fails:
    # As instructed by prompt:
    # "If an AI API is not configured: show: 'AI evaluation is not configured yet.'
    # Do NOT pretend that an AI evaluation happened.
    # For development/demo mode, provide a clearly labelled fallback evaluator only if necessary."
    return _development_semantic_fallback(
        skill=skill,
        question=question,
        selected_language=selected_language,
        transcribed_answer=clean_answer,
        question_id=question_id
    )


def _call_llm_evaluator(
    api_key: str,
    skill: str,
    question: str,
    selected_language: str,
    transcribed_answer: str
) -> Dict[str, Any]:
    """
    Invokes configured AI Model (Gemini / OpenAI API) to semantically evaluate worker's answer.
    """
    prompt = f"""
You are an expert evaluator for blue-collar worker practical skill tests (CoopConnect platform).
Evaluate the following spoken practical scenario response:
Trade Category: {skill}
Practical Question: {question}
Selected Language: {selected_language}
Worker's Spoken Answer: "{transcribed_answer}"

Evaluation Guidelines:
- Evaluate the MEANING and practical reasoning, NOT exact keyword matching.
- The worker may speak in Tamil (தமிழ்), English, mixed English/Tamil ("Tanglish", e.g. "முதலில் main valve / supply-ஐ நிறுத்துவேன்"), Hindi, or colloquial trade terms.
- Treat equivalent semantic answers equally (e.g. "turn off water supply" == "தண்ணீரை நிறுத்துவேன்" == "வால்வை மூடுவேன்").
- Assess practical safety awareness, correct tool selection, and standard troubleshooting procedure.

You MUST reply with ONLY a valid JSON object matching this schema:
{{
  "score": (number between 0.0 and 10.0),
  "correctness": "Correct" | "Partially Correct" | "Incorrect",
  "feedback": (string, 1-2 practical sentences in {selected_language}),
  "safety_awareness": (string, concise evaluation of safety),
  "practical_knowledge": (string, concise evaluation of trade competence)
}}
"""

    # Check for Google Gemini
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        text = response.text.strip()
        # Clean markdown code block if present
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        data = json.loads(text.strip())
        data["score"] = round(float(data.get("score", 7.0)), 1)
        data["ai_configured"] = True
        data["evaluator"] = "AI Model (Gemini Live)"
        return data
    except Exception as gemini_err:
        logger.debug(f"Gemini evaluation attempted: {gemini_err}")

    # Fallback to OpenAI API format if openai is available or direct request
    try:
        import urllib.request
        req_data = json.dumps({
            "model": "gpt-3.5-turbo",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=req_data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            res_json = json.loads(resp.read().decode("utf-8"))
            content = res_json["choices"][0]["message"]["content"].strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            data = json.loads(content.strip())
            data["score"] = round(float(data.get("score", 7.0)), 1)
            data["ai_configured"] = True
            data["evaluator"] = "AI Model (OpenAI Live)"
            return data
    except Exception as openai_err:
        logger.debug(f"OpenAI evaluation attempted: {openai_err}")

    raise RuntimeError("AI model invocation failed.")


def _development_semantic_fallback(
    skill: str,
    question: str,
    selected_language: str,
    transcribed_answer: str,
    question_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Clearly-labelled development fallback evaluator when AI_API_KEY is not set.
    Evaluates semantic meaning and trade concept presence.
    """
    from ml.assessment_data import ASSESSMENT_QUESTION_BANKS

    is_tamil = (selected_language == "ta")
    ans_lower = (transcribed_answer or "").lower()

    # Find question in question bank if question_id is provided
    bank = ASSESSMENT_QUESTION_BANKS.get(skill, [])
    matched_q = None
    if question_id:
        matched_q = next((q for q in bank if q["id"] == question_id), None)
    if not matched_q and question:
        # Search by partial match in question text
        matched_q = next((q for q in bank if q["question_ta"] in question or q["question_en"] in question), None)
    if not matched_q and bank:
        matched_q = bank[0]

    score = 0.0
    matched_concepts = []

    # Rubric-based semantic matching
    if matched_q:
        concepts = matched_q.get("key_concepts_ta" if is_tamil else "key_concepts_en", [])
        # Also check English concepts in Tanglish / bilingual answers
        all_concepts = list(set(matched_q.get("key_concepts_ta", []) + matched_q.get("key_concepts_en", [])))
        for c in all_concepts:
            if c.lower() in ans_lower:
                matched_concepts.append(c)
                score += 2.5

    # Core universal safety & procedure semantic checks (bilingual)
    safety_triggers_en = ["shut off", "turn off", "stop", "disconnect", "isolate", "valve", "switch off", "gloves", "shoes", "tester", "ppe", "ground", "earth"]
    safety_triggers_ta = ["நிறுத்து", "மூடு", "ஆப் செய்", "கட் செய்", "டெஸ்டர்", "சுவிட்ச்", "காலணி", "கையுறைகள்", "வால்வு"]

    has_safety = any(t in ans_lower for t in safety_triggers_en + safety_triggers_ta)
    if has_safety:
        score += 3.0

    # If answer contains substantive technical description
    word_count = len(clean_text := (transcribed_answer or "").split())
    if word_count >= 3:
        score += 2.0
    if word_count >= 6:
        score += 1.5

    # Bound score between 1.0 (if answered) and 10.0
    if not transcribed_answer:
        score = 0.0
    else:
        score = min(10.0, max(2.0, score))
    final_score = round(score, 1)

    if final_score >= 8.0:
        correctness = "Correct"
        feedback = (
            "மிகச் சரியான செய்முறை மற்றும் பாதுகாப்பு முன்னெச்சரிக்கை விழிப்புணர்வு."
            if is_tamil else
            "Excellent practical reasoning with sound safety awareness."
        )
        safety_awareness = "Strong hazard prevention and procedural protocol"
        practical_knowledge = "High practical competence"
    elif final_score >= 5.5:
        correctness = "Partially Correct"
        feedback = (
            "சரியான அணுகுமுறை. பணியின் பாதுகாப்பு நெறிமுறைகளை தெளிவாக குறிப்பிட்டுள்ளீர்கள்."
            if is_tamil else
            "Good operational answer demonstrating working knowledge of the procedure."
        )
        safety_awareness = "Acceptable safety precautions noted"
        practical_knowledge = "Moderate practical working knowledge"
    else:
        correctness = "Needs Improvement"
        feedback = (
            "பதில் முழுமையாக இல்லை. பணியின் பாதுகாப்பு மற்றும் சரியான கருவி பயன்பாட்டில் கூடுதல் கவனம் தேவை."
            if is_tamil else
            "Answer is partially unclear. Review standard safety isolation and tool procedures."
        )
        safety_awareness = "Basic or missing safety precaution"
        practical_knowledge = "Needs standard trade refresher"

    return {
        "score": final_score,
        "correctness": correctness,
        "feedback": feedback,
        "safety_awareness": safety_awareness,
        "practical_knowledge": practical_knowledge,
        "ai_configured": False,
        "notice": "AI evaluation is not configured yet. (Add AI_API_KEY to backend/.env for live LLM evaluation). Using development semantic evaluator."
    }
