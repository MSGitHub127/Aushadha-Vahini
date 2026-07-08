import os
import re
import logging
from gcp_clients import tts_client

logger = logging.getLogger(__name__)

# List of drug names to wrap in US English pronunciation tags inside SSML
DRUG_GLOSSARY = [
    "Amoxicillin",
    "Paracetamol",
    "Insulin Glargine",
    "Oxytocin Injection",
    "Metformin",
    "ORS Sachet"
]

def wrap_drug_names_in_ssml(text: str) -> str:
    """
    Scans the alert text for drug names and wraps them in SSML English language tags
    to prevent pronunciation errors when processed by the Hindi TTS voice.
    """
    formatted_text = text
    for drug in DRUG_GLOSSARY:
        # Case insensitive replacement
        pattern = re.compile(re.escape(drug), re.IGNORECASE)
        formatted_text = pattern.sub(f'<lang xml:lang="en-US">{drug}</lang>', formatted_text)
    
    # Wrap in speak tags
    return f"<speak>{formatted_text}</speak>"

def synthesize_advisory_voice(recommendations: list, output_dir: str = "static/audio", lang: str = "en") -> dict:
    """
    Synthesizes a list of transfer recommendations into a spoken Hindi or English advisory audio file.
    Uses Google Cloud Text-to-Speech API. Falls back to browser speech synthesis if credentials fail.
    """
    # Ensure directory exists
    os.makedirs(output_dir, exist_ok=True)
    output_filename = f"alert_{lang}.mp3"
    output_path = os.path.join(output_dir, output_filename)
    
    # Direct translation dictionaries for speech content
    phc_hi = {
        "PHC Utnoor": "PHC उटनूर",
        "PHC Indervelly": "PHC इन्दरवेल्ली",
        "PHC Narnoor": "PHC नारनूर",
        "PHC Ichoda": "PHC इचोडा",
        "PHC Bazarhatnoor": "PHC बाज़ारहातनूर"
    }
    
    if lang == "hi":
        if not recommendations:
            raw_text = "सभी प्राथमिक स्वास्थ्य केंद्रों में आवश्यक दवाओं का सुरक्षित स्टॉक है। किसी स्थानांतरण की आवश्यकता नहीं है।"
            raw_text_roman = "Sabhi prathmik swasthya kendro mein aavashyak davaon ka surakshit stock hai. Kisi sthanantaran ki aavashyakta nahi hai."
        else:
            raw_text = "मुख्य चिकित्सा अधिकारी, कृपया ध्यान दें। आवश्यक स्थानांतरण का विवरण इस प्रकार है: "
            raw_text_roman = "Mukhya chikitsa adhikari, kripya dhyan den. Aavashyak sthanantaran ka vivaran is prakar hai: "
            for idx, rec in enumerate(recommendations[:3]):
                src = phc_hi.get(rec['source_phc_name'], rec['source_phc_name'])
                tgt = phc_hi.get(rec['target_phc_name'], rec['target_phc_name'])
                med = rec['medicine_name']
                qty = rec['quantity']
                unit = "टैबलेट" if rec['unit'].lower() == "tablets" else rec['unit']
                unit_roman = "tablets" if rec['unit'].lower() == "tablets" else rec['unit']
                dist = rec['distance_km']
                is_critical = rec['urgency_score'] >= 5.0
                urgency = "अति आवश्यक" if is_critical else "सामान्य"
                urgency_roman = "ati aavashyak" if is_critical else "samanya"
                
                raw_text += f"क्रमांक {idx+1}: {src} से {tgt} को {qty} {unit} {med} {dist} किलोमीटर की दूरी पर भेजें, जो कि {urgency} है। "
                raw_text_roman += f"Kramaank {idx+1}: {rec['source_phc_name']} se {rec['target_phc_name']} ko {qty} {unit_roman} {med} {dist} kilometer ki doori par bhejen, jo ki {urgency_roman} hai. "
        
        ssml_payload = wrap_drug_names_in_ssml(raw_text)
        voice_params = {"language_code": "hi-IN", "name": "hi-IN-Wavenet-C"}
    else:
        if not recommendations:
            raw_text = "All primary health centers have secure stocks of essential medicines. No immediate transfers are required."
            raw_text_roman = raw_text
        else:
            raw_text = "Chief Medical Officer, please note. Here are the details of required transfers: "
            raw_text_roman = raw_text
            for idx, rec in enumerate(recommendations[:3]):
                raw_text += (
                    f"Number {idx+1}: Transfer {rec['quantity']} {rec['unit']} of {rec['medicine_name']} "
                    f"from Primary Health Center {rec['source_phc_name']} to Health Center {rec['target_phc_name']} "
                    f"over a distance of {rec['distance_km']} kilometers. "
                )
                raw_text_roman += (
                    f"Number {idx+1}: Transfer {rec['quantity']} {rec['unit']} of {rec['medicine_name']} "
                    f"from Primary Health Center {rec['source_phc_name']} to Health Center {rec['target_phc_name']} "
                    f"over a distance of {rec['distance_km']} kilometers. "
                )
        
        ssml_payload = wrap_drug_names_in_ssml(raw_text)
        voice_params = {"language_code": "en-US", "name": "en-US-Wavenet-C"}

    # Attempt Google Cloud Text-to-Speech client call
    try:
        if not tts_client:
            raise Exception("GCP Text-to-Speech client not initialized")
        from google.cloud import texttospeech
        synthesis_input = texttospeech.SynthesisInput(ssml=ssml_payload)
        
        voice = texttospeech.VoiceSelectionParams(
            language_code=voice_params["language_code"],
            name=voice_params["name"]
        )
        
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3
        )
        
        logger.info("Calling Google Cloud Text-to-Speech API...")
        response = tts_client.synthesize_speech(
            input=synthesis_input, voice=voice, audio_config=audio_config
        )
        
        # Save the audio file
        with open(output_path, "wb") as out:
            out.write(response.audio_content)
            
        logger.info(f"Synthesized voice alert saved to {output_path}")
        return {
            "success": True,
            "fallback_to_browser": False,
            "text": raw_text,
            "text_roman": raw_text_roman,
            "lang": "hi-IN" if lang == "hi" else "en-US",
            "audio_url": f"/static/audio/{output_filename}"
        }
        
    except Exception as e:
        logger.warning(f"GCP Text-to-Speech failed: {e}. Defaulting to browser SpeechSynthesis fallback.")
        # Return fallback directives so that the frontend can read the text directly in the browser
        return {
            "success": False,
            "fallback_to_browser": True,
            "text": raw_text,
            "text_roman": raw_text_roman,
            "lang": "hi-IN" if lang == "hi" else "en-US",
            "audio_url": None
        }
