
let speechVoices = [];
let activeUtterances = [];
function loadSpeechVoices() {
    if (window.speechSynthesis) {
        speechVoices = window.speechSynthesis.getVoices();
        console.log("Speech voice cache populated. Count:", speechVoices.length);
    }
}
loadSpeechVoices();
if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = loadSpeechVoices;
}

// Active Tab Management
let activeTab = localStorage.getItem('active_tab') || 'dashboard';
let alertsData = [];
let reviewQueue = [];
let fontScale = 1.0;
let voiceGuideActive = false;
let currentLang = localStorage.getItem('pref_lang') || 'en';

const TRANSLATIONS = {
    en: {
        "nav-dashboard": "Dashboard",
        "nav-doctors": "Doctors",
        "nav-beds": "Beds",
        "nav-patients": "Patients",
        "nav-upload": "Diagnostics (OCR)",
        "nav-review": "Verification Queue",
        "nav-transfers": "AI Predictions",
        "nav-reports": "Reports",
        "nav-settings": "Settings",
        
        "map-card-title": "🗺️ District Spatial Map (Adilabad)",
        "map-card-desc": "Green = Healthy, Yellow = Warning, Red = Deficit. Click nodes to select PHC.",
        "shortages-title": "⚠️ Active Inventory Shortages",
        "calib-card-title": "⚙️ System Calibration",
        
        "ocr-title": "📷 Upload Daily Log Sheet / Stock Photo",
        "ocr-subtitle": "Snap or upload a photo of the handwritten stock sheet. Gemini AI digitizes and updates counts automatically.",
        "drag-drop-text": "Drag & Drop Image Here or Click to Scan",
        "upload-zone-sub": "Supports JPG, PNG, WebP format",
        "select-phc-label": "Select Primary Health Center: ",
        "demo-helpers-title": "Hackathon Quick Demos (Try both flows):",
        "clean-sheet-title": "Clear Handwritten Sheet",
        "clean-sheet-desc": "Directly updates BQ Database (Confidence: 94%)",
        "blurred-sheet-title": "Blurry / Messy Sheet",
        "blurred-sheet-desc": "Routes to Verification Queue (Confidence: 68%)",
        "preview-title": "🔍 Gemini Extraction Live Preview",
        "preview-placeholder-text": "Image extraction results will render here after upload.",
        
        "review-title": "✏️ Human-in-the-Loop Review Queue",
        "review-desc": "Review and correct low-confidence OCR results. Verify values against the uploaded image reference before updating inventory.",
        
        "optimizer-title": "🚚 Drug Redistribution Routing Optimizer",
        "optimizer-desc": "Calculates optimal drug transfers from surplus clinics to deficit clinics. Minimizes driving distances using the Haversine equation.",
        "btn-run-optimization": "🚀 Run Redistribution Optimizer",
        "tts-spokes-title": "System Spoken Advisory (Hindi Multi-Lang SSML)",
        "btn-listen-tts": "🔊 Listen Spoken Alert",
        
        "alert-val-stock": "Medicine Stock",
        "alert-val-beds": "Bed Availability",
        "alert-val-docs": "Doctor Attendance",
        "alert-val-patients": "Patient Footfall",
        "alert-val-critical": "Critical Alerts",
        
        "trans-th-status": "Urgency",
        "trans-th-med": "Medicine",
        "trans-th-src": "Source Clinic",
        "trans-th-tgt": "Destination Clinic",
        "trans-th-qty": "Transfer Quantity",
        "trans-th-dist": "Route Distance",
        "trans-th-impact": "Impact Score",
        "transfers-fallback-prompt": "Click \"Run Redistribution Optimizer\" to calculate supply routing plans.",

        "trend-card-title": "📊 Medicine Consumption & Patient Footfall",
        "trend-card-desc": "Weekly trending data across Adilabad clinics",
        "timeline-card-title": "📜 Live Activity & Alerts Timeline",
        "timeline-card-desc": "Adilabad PHC network audit events",
        "event-utnoor-desc": "Paracetamol stock levels critical",
        "event-narnoor-desc": "1 Doctor Absent (O.D. leave)",
        "event-bazar-desc": "Bed Occupancy reached 85%",
        "event-inder-desc": "OCR sheet verified & committed",
        
        "doc-card-title": "👨‍⚕️ Doctor Attendance & Rostering",
        "doc-card-desc": "Real-time attendance registry and clinic assignments across the district.",
        "doc-th-name": "Doctor Name",
        "doc-th-spec": "Specialization",
        "doc-th-phc": "Assigned PHC",
        "doc-th-status": "Today's Status",
        "doc-th-time": "Check-in Time",
        
        "beds-card-title": "🛏️ Bed Occupancy & Ward Telemetry",
        "beds-card-desc": "Live status of critical care, general, and emergency wards in Adilabad clinics.",
        "beds-th-phc": "Primary Health Center",
        "beds-th-gen": "General Wards",
        "beds-th-icu": "Emergency / ICU Wards",
        "beds-th-occ": "Total Wards Occupancy",
        "beds-th-act": "Action",
        
        "pat-card-title": "👥 Patient Outpatient (OPD) Flow",
        "pat-card-desc": "Active registrations, disease triages, and weekly case allocations.",
        "pat-th-phc": "PHC Clinic",
        "pat-th-opd": "Daily OPD Count",
        "pat-th-sym": "Predominant Symptoms / Diagnostics",
        "pat-th-sev": "Triage Severity",
        "pat-th-act": "Action",
        
        "rep-card-title": "📝 District Supply Audits & Reports",
        "rep-card-desc": "Download consolidated reports or generate direct National Health Mission compliance files.",
        "rep-sub1-title": "Standard Supply Logs",
        "rep-sub1-desc": "Automated monthly inventory reports detailing deficit audits and transfer summaries.",
        "btn-gen-nhm": "📄 Generate NHM Report",
        "rep-sub2-title": "Logistics Transfer Ledger",
        "rep-sub2-desc": "Complete list of transfers recommended, approved, and completed between Adilabad PHCs.",
        "btn-download-ledger": "📊 Download Transfer Ledger",
        
        "set-card-title": "⚙️ System Settings & Calibration",
        "set-card-desc": "Configure BQ ARIMA_PLUS model parameters, emergency thresholds, and audio rate overrides.",
        "label-horizon": "ARIMA Forecasting Horizon (Days)",
        "label-radius": "Redistribution Route Search Radius (KM)",
        "label-speed": "TTS Spoken Voice Rate Modifier",
        "btn-save-settings": "💾 Save Calibration Settings",
        "greet-district-officer": "Good Morning, District Officer",
        "ai-hero-title": "✨ AI Assistant (predictive & reasoning layers)",
        "ai-alert-title": "PHC Utnoor: Paracetamol Low",
        "ai-alert-desc": "ARIMA_PLUS model predicts shortage in 5 days due to a seasonal Dengue consumption spike.",
        "ai-suggested-action-html": "Suggested Action: Transfer <strong>120 units</strong> of Paracetamol from <strong>PHC Indervelly</strong> (Surplus).",
        "btn-accept-recommendation-html": "⚡ Accept Recommendation",
        "btn-flush-uploads": "🗑️ Flush Uploads"
    },
    hi: {
        "nav-dashboard": "Dashboard",
        "nav-doctors": "Doctors",
        "nav-beds": "Beds",
        "nav-patients": "Patients",
        "nav-upload": "Diagnostics (OCR)",
        "nav-review": "Verification Queue",
        "nav-transfers": "AI Predictions",
        "nav-reports": "Reports",
        "nav-settings": "Settings",
        
        "map-card-title": "🗺️ District Spatial Map (Adilabad)",
        "map-card-desc": "हरा = सुरक्षित, पीला = सामान्य कमी, लाल = अति आवश्यक कमी। PHC चुनने के लिए नोड्स पर क्लिक करें।",
        "shortages-title": "⚠️ Active Inventory Shortages",
        "calib-card-title": "⚙️ System Calibration",
        
        "ocr-title": "📷 Upload Daily Log Sheet / Stock Photo",
        "ocr-subtitle": "हस्तलिखित रजिस्टर का फोटो लें या अपलोड करें। Gemini AI इसे डिजिटल बनाकर BQ Database में सुरक्षित करता है।",
        "drag-drop-text": "यहाँ Image खींचें और छोड़ें या Scan करने के लिए क्लिक करें",
        "upload-zone-sub": "JPG, PNG, WebP format का समर्थन करता है",
        "select-phc-label": "Select Primary Health Center (PHC): ",
        "demo-helpers-title": "Hackathon Quick Demos (दोनों प्रवाह आज़माएं):",
        "clean-sheet-title": "Clear Handwritten Sheet",
        "clean-sheet-desc": "सीधे BQ Database को Update करता है (Confidence: 94%)",
        "blurred-sheet-title": "Blurry / Messy Sheet",
        "blurred-sheet-desc": "Verification Queue में भेजता है (Confidence: 68%)",
        "preview-title": "🔍 Gemini Extraction Live Preview",
        "preview-placeholder-text": "Upload के बाद extraction परिणाम यहाँ दिखाई देंगे।",
        
        "review-title": "✏️ Human-in-the-Loop Review Queue",
        "review-desc": "कम आत्मविश्वास वाले OCR परिणामों की समीक्षा करें और सही करें। Inventory अपडेट करने से पहले संदर्भ छवि के विरुद्ध मान सत्यापित करें।",
        
        "optimizer-title": "🚚 Drug Redistribution Routing Optimizer",
        "optimizer-desc": "अधिशेष क्लीनिकों से कमी वाले क्लीनिकों में दवा स्थानांतरण की गणना करता है। Haversine समीकरण का उपयोग करके ड्राइविंग दूरी को कम करता है।",
        "btn-run-optimization": "🚀 Run Redistribution Optimizer",
        "tts-spokes-title": "System Spoken Advisory (Hindi Multi-Lang SSML)",
        "btn-listen-tts": "🔊 Listen Spoken Alert",
        
        "alert-val-stock": "दवा स्टॉक",
        "alert-val-beds": "बेड उपलब्धता",
        "alert-val-docs": "डॉक्टर उपस्थिति",
        "alert-val-patients": "मरीजों की संख्या",
        "alert-val-critical": "अति आवश्यक अलर्ट",
        
        "trans-th-status": "Urgency",
        "trans-th-med": "Medicine",
        "trans-th-src": "Source Clinic",
        "trans-th-tgt": "Destination Clinic",
        "trans-th-qty": "Transfer Quantity",
        "trans-th-dist": "Route Distance",
        "trans-th-impact": "Impact Score",
        "transfers-fallback-prompt": "आपूर्ति पुनर्वितरण मार्ग की गणना करने के लिए \"Run Redistribution Optimizer\" पर क्लिक करें।",

        "trend-card-title": "📊 Medicine Consumption & Patient Footfall",
        "trend-card-desc": "आदिलाबाद क्लीनिकों में साप्ताहिक खपत और मरीज़ों का ट्रेंड",
        "timeline-card-title": "📜 Live Activity & Alerts Timeline",
        "timeline-card-desc": "आदिलाबाद PHC नेटवर्क के महत्वपूर्ण ऑडिट और अपडेट",
        "event-utnoor-desc": "Paracetamol stock levels critical (पैरासिटामॉल स्टॉक स्तर अति आवश्यक)",
        "event-narnoor-desc": "1 Doctor Absent (1 डॉक्टर अनुपस्थित हैं)",
        "event-bazar-desc": "Bed Occupancy reached 85% (बिस्तरों की उपलब्धता 85% तक पहुँच चुकी है)",
        "event-inder-desc": "OCR sheet verified & committed (OCR रजिस्टर सत्यापित और सबमिट किया गया)",
        
        "doc-card-title": "👨‍⚕️ Doctor Attendance & Rostering",
        "doc-card-desc": "आदिलाबाद जिले के विभिन्न स्वास्थ्य केंद्रों में डॉक्टरों की वास्तविक समय उपस्थिति और रोस्टर विवरण।",
        "doc-th-name": "Doctor Name",
        "doc-th-spec": "Specialization",
        "doc-th-phc": "Assigned PHC",
        "doc-th-status": "Today's Status",
        "doc-th-time": "Check-in Time",
        
        "beds-card-title": "🛏️ Bed Occupancy & Ward Telemetry",
        "beds-card-desc": "आदिलाबाद के विभिन्न प्राथमिक स्वास्थ्य केंद्रों में सामान्य और आपातकालीन (ICU) वार्डों की स्थिति।",
        "beds-th-phc": "Primary Health Center",
        "beds-th-gen": "General Wards",
        "beds-th-icu": "Emergency / ICU Wards",
        "beds-th-occ": "Total Wards Occupancy",
        "beds-th-act": "Action",
        
        "pat-card-title": "👥 Patient Outpatient (OPD) Flow",
        "pat-card-desc": "सक्रिय आउटपेरिएंट (OPD) पंजीकरण, प्राथमिक रोग लक्षण और साप्ताहिक केस आवंटन विवरण।",
        "pat-th-phc": "PHC Clinic",
        "pat-th-opd": "Daily OPD Count",
        "pat-th-sym": "Predominant Symptoms / Diagnostics",
        "pat-th-sev": "Triage Severity",
        "pat-th-act": "Action",
        
        "rep-card-title": "📝 District Supply Audits & Reports",
        "rep-card-desc": "समेकित स्टॉक ऑडिट रिपोर्ट डाउनलोड करें या सीधे राष्ट्रीय स्वास्थ्य मिशन (NHM) अनुपालन फाइलें जनरेट करें।",
        "rep-sub1-title": "Standard Supply Logs",
        "rep-sub1-desc": "मासिक आधार पर स्वचालित इन्वेंटरी रिपोर्ट जिसमें कमी वाले दवाओं और स्थानांतरणों का विवरण होता है।",
        "btn-gen-nhm": "📄 Generate NHM Report",
        "rep-sub2-title": "Logistics Transfer Ledger",
        "rep-sub2-desc": "Adilabad PHCs के बीच अनुशंसित, स्वीकृत और पूर्ण किए गए सभी दवा स्थानांतरणों की पूर्ण सूची।",
        "btn-download-ledger": "📊 Download Transfer Ledger",
        
        "set-card-title": "⚙️ System Settings & Calibration",
        "set-card-desc": "BigQuery ARIMA_PLUS पूर्वानुमान मॉडल, सुरक्षा सीमा (safety thresholds) और वॉयस एडवाइजरी दरों को कैलिब्रेट करें।",
        "label-horizon": "ARIMA Forecasting Horizon (Days)",
        "label-radius": "Redistribution Route Search Radius (KM)",
        "label-speed": "TTS Spoken Voice Rate Modifier",
        "btn-save-settings": "💾 Save Calibration Settings",
        "greet-district-officer": "शुभ प्रभात, जिला अधिकारी",
        "ai-hero-title": "✨ एआई सहायक (अनुमानित और तर्क परतें)",
        "ai-alert-title": "PHC Utnoor: Paracetamol की कमी",
        "ai-alert-desc": "ARIMA_PLUS मॉडल मौसमी डेंगू की खपत में वृद्धि के कारण 5 दिनों में कमी का अनुमान लगाता है।",
        "ai-suggested-action-html": "सुझाया गया कार्य: <strong>PHC Indervelly</strong> (अधिशेष) से Paracetamol की <strong>120 इकाइयाँ</strong> स्थानांतरित करें।",
        "btn-accept-recommendation-html": "⚡ सिफारिश स्वीकार करें",
        "btn-flush-uploads": "🗑️ अपलोड साफ़ करें"
    }
};

let coordinates = {
    1: { name: "PHC Utnoor", x: 250, y: 220 },
    2: { name: "PHC Indervelly", x: 180, y: 160 },
    3: { name: "PHC Narnoor", x: 300, y: 110 },
    4: { name: "PHC Ichoda", x: 120, y: 200 },
    5: { name: "PHC Bazarhatnoor", x: 70, y: 140 },
};

document.addEventListener('DOMContentLoaded', () => {
    // Initial language setup
    const activeBtn = document.getElementById(`lang-${currentLang}`);
    if (activeBtn) {
        document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
        activeBtn.classList.add('active');
    }
    applyStaticTranslations();
    switchTab(activeTab);
    
    refreshData();
    updateGcpHud();
    setupUploadHandlers();
    setInterval(refreshData, 10000);
});

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('pref_lang', lang);
    
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`lang-${lang}`);
    if (activeBtn) activeBtn.classList.add('active');
    
    applyStaticTranslations();
    switchTab(activeTab); // Refresh dynamic header texts
    
    if (activeTab !== 'transfers') {
        refreshData();
    }
}

function applyStaticTranslations() {
    const dict = TRANSLATIONS[currentLang];
    if (!dict) return;
    for (const [id, val] of Object.entries(dict)) {
        const el = document.getElementById(id);
        if (el) {
            if (id.endsWith("-html")) {
                el.innerHTML = val;
            } else {
                const navLabel = el.querySelector('.nav-label');
                if (navLabel) {
                    navLabel.textContent = val;
                } else {
                    el.textContent = val;
                }
            }
        }
    }

    // Translate PHC Names
    document.querySelectorAll('[data-translate-phc]').forEach(el => {
        const key = el.dataset.translatePhc;
        const phcMap = {
            en: {
                'utnoor': 'PHC Utnoor',
                'indervelly': 'PHC Indervelly',
                'narnoor': 'PHC Narnoor',
                'ichoda': 'PHC Ichoda',
                'bazarhatnoor': 'PHC Bazarhatnoor'
            },
            hi: {
                'utnoor': 'PHC उटनूर',
                'indervelly': 'PHC इन्दरवेल्ली',
                'narnoor': 'PHC नारनूर',
                'ichoda': 'PHC इचोडा',
                'bazarhatnoor': 'PHC बाज़ारहातनूर'
            }
        };
        el.textContent = phcMap[currentLang][key] || el.textContent;
    });

    // Translate Doctor Names
    document.querySelectorAll('[data-translate-doc]').forEach(el => {
        const key = el.dataset.translateDoc;
        const docMap = {
            en: {
                'ramesh': 'Dr. Ramesh Rao',
                'ananya': 'Dr. Ananya Reddy',
                'suresh': 'Dr. Suresh Naidu',
                'srinivas': 'Dr. K. Srinivas',
                'monica': 'Dr. Monica Paul'
            },
            hi: {
                'ramesh': 'डॉ. रमेश राव',
                'ananya': 'डॉ. अनन्या रेड्डी',
                'suresh': 'डॉ. सुरेश नायडू',
                'srinivas': 'डॉ. के. श्रीनिवास',
                'monica': 'डॉ. मोनिका पॉल'
            }
        };
        el.textContent = docMap[currentLang][key] || el.textContent;
    });

    // Translate Status Labels
    document.querySelectorAll('[data-translate-status]').forEach(el => {
        const key = el.dataset.translateStatus;
        const statusMap = {
            en: {
                'present': 'Present',
                'absent': 'Absent (On Leave)',
                'late': 'Late',
                'moderate': 'Moderate',
                'lowrisk': 'Low Risk',
                'severe': 'Severe Outbreak'
            },
            hi: {
                'present': 'उपस्थित',
                'absent': 'अनुपस्थित (अवकाश पर)',
                'late': 'विलंब',
                'moderate': 'सामान्य खतरा',
                'lowrisk': 'कम खतरा',
                'severe': 'गंभीर प्रकोप'
            }
        };
        el.textContent = statusMap[currentLang][key] || el.textContent;
    });

    // Translate Generic Words
    document.querySelectorAll('[data-translate-word]').forEach(el => {
        const key = el.dataset.translateWord;
        const wordMap = {
            en: {
                'available': 'Available',
                'occupied': 'Occupied',
                'high': 'High',
                'critical': 'Critical',
                'manage': 'Manage',
                'emergency': 'Emergency',
                'details': 'Details',
                'epidemic_alert': 'Epidemic Alert',
                'patients': 'patients'
            },
            hi: {
                'available': 'उपलब्ध',
                'occupied': 'उपभोग',
                'high': 'उच्च',
                'critical': 'गंभीर',
                'manage': 'प्रबंधित करें',
                'emergency': 'आपातकालीन',
                'details': 'विवरण',
                'epidemic_alert': 'महामारी अलर्ट',
                'patients': 'मरीज'
            }
        };
        el.textContent = wordMap[currentLang][key] || el.textContent;
    });
}

// ----------------------------------------------------
// ACCESSIBILITY & ELDER FRIENDLY FEATURES
// ----------------------------------------------------
function changeFontSize(action) {
    const root = document.documentElement;
    const buttons = document.querySelectorAll('.btn-acc');
    
    // Remove active class from all font sizing buttons
    buttons.forEach(btn => btn.classList.remove('active'));
    
    if (action === 'decrease') {
        fontScale = 0.85;
        event.currentTarget.classList.add('active');
    } else if (action === 'increase') {
        fontScale = 1.25; // 25% Larger text for elders
        event.currentTarget.classList.add('active');
    } else {
        fontScale = 1.0;
        document.getElementById('btn-font-normal').classList.add('active');
    }
    
    root.style.setProperty('--font-scale', fontScale);
    loggerSpeak("आकार बदल दिया गया है", `Font size scaled to ${fontScale}`);
}

function toggleVoiceGuide() {
    voiceGuideActive = !voiceGuideActive;
    const btn = document.getElementById('voice-guide-btn');
    
    if (voiceGuideActive) {
        btn.classList.add('active');
        btn.innerHTML = "🔊 Active";
        speakScreenContext();
    } else {
        btn.classList.remove('active');
        btn.innerHTML = "🔊 Assist";
        window.speechSynthesis.cancel();
    }
}

function speakScreenContext() {
    if (!voiceGuideActive) return;
    
    let text = "";
    let textRoman = "";
    
    if (currentLang === 'hi') {
        if (activeTab === 'dashboard') {
            text = "यह मुख्य जिला अवलोकन मानचित्र दृश्य है। सुरक्षित स्वास्थ्य केंद्र हरे रंग में हैं, और कमी वाले लाल या पीले रंग में हैं।";
            textRoman = "Yeh mukhya jila avalokan manchitra drishya hai. Surakshit swasthya kendra hare rang mein hain, aur kami vale laal ya peele rang mein hain.";
        } else if (activeTab === 'upload') {
            text = "यहाँ आप दैनिक स्टॉक रजिस्टर का फोटो अपलोड कर सकते हैं। विश्लेषण के लिए नीचे दिए गए स्कैन नियंत्रणों का उपयोग करें।";
            textRoman = "Yahan aap dainik stock register ka photo upload kar sakte hain. Vishleshan ke liye neeche diye gaye scan niyantrano ka upayog karein.";
        } else if (activeTab === 'review') {
            text = "यह मानव सत्यापन कतार है जहाँ कम आत्मविश्वास वाली रीडिंग को मैन्युअल जांच के लिए रखा जाता है।";
            textRoman = "Yeh manav satyapan katar hai yahan kam aatmavishvas vali reading ko manual jaanch ke liye rakha jata hai.";
        } else if (activeTab === 'transfers') {
            text = "यह एआई पूर्वानुमान रूट प्लानर है जो दवाओं के स्थानांतरण की सिफारिश करता है।";
            textRoman = "Yeh AI poorvanuman route planner hai jo davaon ke sthanantaran ki sipharish karta hai.";
        } else if (activeTab === 'doctors') {
            text = "यह डॉक्टर उपस्थिति और पीएचसी असाइनमेंट रोस्टर ट्रैकर है।";
            textRoman = "Yeh doctor upasthiti aur PHC assignment roster tracker hai.";
        } else if (activeTab === 'beds') {
            text = "यह बेड उपलब्धता और आईसीयू वार्ड उपलब्धता टेलीमेट्री दृश्य है।";
            textRoman = "Yeh bed upalabdhata aur ICU ward upalabdhata telemetry drishya hai.";
        } else if (activeTab === 'patients') {
            text = "यह सक्रिय मरीज ओपीडी प्रवाह और बीमारी गंभीरता ट्रैकर दृश्य है।";
            textRoman = "Yeh sakriya mareej OPD pravah aur beemari gambheerata tracker drishya hai.";
        } else if (activeTab === 'reports') {
            text = "यह रिपोर्ट जनरेटर है जहाँ आप मासिक अनुपालन फाइलें डाउनलोड कर सकते हैं।";
            textRoman = "Yeh report generator hai jahan aap maasik anupalan filein download kar sakte hain.";
        } else if (activeTab === 'settings') {
            text = "यह पूर्वानुमान मॉडल और सीमा विन्यास के लिए सिस्टम सेटिंग्स है।";
            textRoman = "Yeh poorvanuman model aur seema viniyas ke liye system settings hai.";
        }
    } else {
        if (activeTab === 'dashboard') {
            text = "This is the primary map view showing all health center statuses in the district. Optimal clinics are in green, while deficit ones are marked in red or yellow.";
            textRoman = text;
        } else if (activeTab === 'upload') {
            text = "Here you can upload a photo of the daily stock sheets. Use the scanning controls below to test.";
            textRoman = text;
        } else if (activeTab === 'review') {
            text = "This is the verification queue where OCR text readings with low confidence are flagged for human validation.";
            textRoman = text;
        } else if (activeTab === 'transfers') {
            text = "This is the AI predictions route planner recommending stock redistributions to solve deficits.";
            textRoman = text;
        } else if (activeTab === 'doctors') {
            text = "This is the doctor attendance and assignment registry tracking staff across clinics.";
            textRoman = text;
        } else if (activeTab === 'beds') {
            text = "This is the bed occupancy telemetry and critical care ward availability view.";
            textRoman = text;
        } else if (activeTab === 'patients') {
            text = "This is the active patient outpatient flow and disease severity tracker.";
            textRoman = text;
        } else if (activeTab === 'reports') {
            text = "This is the reports generator where you can download logistics ledgers and compliance files.";
            textRoman = text;
        } else if (activeTab === 'settings') {
            text = "This is the system settings panel for model horizons, radius, and speed adjustments.";
            textRoman = text;
        }
    }
    
    let useText = text;
    let useLang = currentLang === 'hi' ? 'hi-IN' : 'en-US';
    
    if (speechVoices.length === 0 && window.speechSynthesis) {
        speechVoices = window.speechSynthesis.getVoices();
    }
    const safeVoices = speechVoices.filter(v => v && typeof v.lang === 'string');
    
    if (useLang.startsWith('hi')) {
        const hasHindiVoice = safeVoices.some(v => {
            const voiceLang = v.lang.toLowerCase().replace('_', '-');
            return voiceLang.startsWith('hi');
        });
        
        if (!hasHindiVoice) {
            console.warn("No Hindi voice pack detected for Assist. Using Romanized Hindi fallback.");
            useText = textRoman;
            useLang = 'en-US';
        }
    }
    
    const utterance = new SpeechSynthesisUtterance(useText);
    utterance.lang = useLang;
    utterance.rate = 0.85;
    
    speakWithVoice(utterance, speechVoices, useLang);
}

function loggerSpeak(text, engLog) {
    console.log(engLog);
    if (!voiceGuideActive) return;
    
    let speechText = text;
    let speechTextRoman = text;
    
    if (currentLang === 'hi') {
        const logHi = {
            "Calculating optimal distribution routes": "वितरण मार्ग निकाला जा रहा है",
            "Uploading inventory image for scanner analysis": "दवा स्टॉक इमेज अपलोड की जा रही है",
            "Analyzing handwritten document layout": "दस्तावेज़ लेआउट का विश्लेषण किया जा रहा है",
            "Digitization complete and committed": "डिजिटलीकरण पूरा हुआ और सुरक्षित किया गया",
            "Directing record to human review queue": "सत्यापन कतार में भेजा गया",
            "आकार बदल दिया गया है": "आकार बदल दिया गया है"
        };
        const logHiRoman = {
            "Calculating optimal distribution routes": "Vitaran marg nikala ja raha hai",
            "Uploading inventory image for scanner analysis": "Dava stock image upload ki ja rahi hai",
            "Analyzing handwritten document layout": "Dastavez layout ka vishleshan kiya ja raha hai",
            "Digitization complete and committed": "Digitization poora hua aur surakshit kiya gaya",
            "Directing record to human review queue": "Satyapan katar mein bheja gaya",
            "आकार बदल दिया गया है": "Aakaar badal diya gaya hai"
        };
        speechText = logHi[text] || text;
        speechTextRoman = logHiRoman[text] || speechText;
    }
    
    let useText = speechText;
    let useLang = currentLang === 'hi' ? 'hi-IN' : 'en-US';
    
    if (speechVoices.length === 0 && window.speechSynthesis) {
        speechVoices = window.speechSynthesis.getVoices();
    }
    const safeVoices = speechVoices.filter(v => v && typeof v.lang === 'string');
    
    if (useLang.startsWith('hi')) {
        const hasHindiVoice = safeVoices.some(v => {
            const voiceLang = v.lang.toLowerCase().replace('_', '-');
            return voiceLang.startsWith('hi');
        });
        
        if (!hasHindiVoice) {
            useText = speechTextRoman;
            useLang = 'en-US';
        }
    }
    
    const utterance = new SpeechSynthesisUtterance(useText);
    utterance.lang = useLang;
    utterance.rate = 0.85;
    
    speakWithVoice(utterance, speechVoices, useLang);
}

// ----------------------------------------------------
// TABS NAVIGATION & RENDERING
// ----------------------------------------------------
function switchTab(tabId) {
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    // Find trigger item
    const trigger = Array.from(document.querySelectorAll('.nav-item')).find(btn => {
        const onc = btn.getAttribute('onclick');
        return onc && onc.includes('switchTab') && onc.includes(tabId);
    });
    if (trigger) trigger.classList.add('active');
    
    // Update header labels
    const titleMap = currentLang === 'hi' ? {
        'dashboard': { title: 'District Overview', subtitle: 'स्वास्थ्य केंद्रों की वास्तविक समय स्टॉक स्थिति' },
        'doctors': { title: 'Doctor Attendance & Rostering', subtitle: 'ड्यूटी रोस्टर और पीएचसी असाइनमेंट आंकड़े' },
        'beds': { title: 'Bed Occupancy & Ward Telemetry', subtitle: 'आईसीयू और सामान्य बिस्तरों की ट्रैकिंग' },
        'patients': { title: 'Patient Outpatient OPD Flow', subtitle: 'सक्रिय पंजीकरण और रोग वर्गीकरण' },
        'upload': { title: 'OCR Log Sheet Digitizer', subtitle: 'Gemini मल्टीमॉडल इन्वेंटरी पार्सर' },
        'review': { title: 'Verification Queue', subtitle: 'कम आत्मविश्वास वाले OCR रीडिंग का सत्यापन' },
        'transfers': { title: 'Route Optimizer', subtitle: 'दूरी-न्यूनतम वितरण रसद समाधान' },
        'reports': { title: 'Reports & Supply Logs', subtitle: 'समेकित ऑडिट और राष्ट्रीय स्वास्थ्य मिशन रिपोर्ट' },
        'settings': { title: 'System Settings', subtitle: 'पूर्वानुमान मॉडल और खोज त्रिज्या विन्यास' },
    } : {
        'dashboard': { title: 'District Overview', subtitle: 'Real-time PHC Inventory Status' },
        'doctors': { title: 'Doctor Attendance & Rostering', subtitle: 'Roster stats and clinic assignments' },
        'beds': { title: 'Bed Occupancy & Ward Telemetry', subtitle: 'ICU and general ward availability tracking' },
        'patients': { title: 'Patient Outpatient OPD Flow', subtitle: 'Active registrations and disease triages' },
        'upload': { title: 'OCR Log Sheet Digitizer', subtitle: 'Gemini Multimodal Stock Parser' },
        'review': { title: 'Verification Queue', subtitle: 'Human-in-the-Loop OCR Validation' },
        'transfers': { title: 'Route Optimizer', subtitle: 'Distance-Minimized Logistics Solver' },
        'reports': { title: 'Reports & Supply Logs', subtitle: 'Consolidated audits and compliance generator' },
        'settings': { title: 'System Settings', subtitle: 'Calibration of forecast models and search radius' },
    };
    
    document.getElementById('tab-title').innerText = titleMap[tabId].title;
    document.getElementById('tab-subtitle').innerText = titleMap[tabId].subtitle;
    activeTab = tabId;
    localStorage.setItem('active_tab', tabId);
    
    if (tabId === 'review') {
        loadReviewQueue();
    } else if (tabId === 'transfers') {
        runOptimization();
    }
    
    speakScreenContext();
}

// ----------------------------------------------------
// AJAX PIPELINES
// ----------------------------------------------------
async function refreshData() {
    try {
        const response = await fetch('/api/alerts');
        alertsData = await response.json();
        renderAlerts();
        renderMap();
        loadReviewQueueBadge();
        updateGcpHud();
    } catch (e) {
        console.error("Error refreshing data:", e);
    }
}

function renderAlerts() {
    const container = document.getElementById('alerts-container');
    if (!container) return;
    
    // Update Executive Summary Strip with logo-inspired KPIs
    const stockouts = alertsData.filter(item => item.status === 'STOCKOUT').length;
    const total = alertsData.length || 1;
    const deficits = alertsData.filter(item => ["STOCKOUT", "CRITICAL_DEFICIT", "WARNING_DEFICIT"].includes(item.status)).length;
    const health = Math.max(0, Math.min(100, Math.round(((total - deficits) / total) * 100)));
    
    const warnings = alertsData.filter(item => item.status !== 'OPTIMAL' && item.status !== 'SURPLUS');
    
    const valStockouts = document.getElementById('val-stockouts');
    const valBeds = document.getElementById('val-beds');
    const valDoctors = document.getElementById('val-doctors');
    const valFootfall = document.getElementById('val-footfall');
    const valAlerts = document.getElementById('val-alerts');
    const tileAlerts = document.getElementById('tile-alerts');
    
    if (valStockouts) valStockouts.innerText = `${health}%`;
    if (valBeds) valBeds.innerText = '74%';
    if (valDoctors) valDoctors.innerText = '91%';
    if (valFootfall) valFootfall.innerText = '+18%';
    if (valAlerts) valAlerts.innerText = warnings.length;
    
    if (tileAlerts) {
        if (warnings.length > 0) {
            tileAlerts.classList.add('pulse-red');
        } else {
            tileAlerts.classList.remove('pulse-red');
        }
    }


    
    if (warnings.length === 0) {
        container.innerHTML = `
            <div class="alert-item optimal">
                <div class="alert-item-header">
                    <span>सभी केंद्र सुरक्षित हैं</span>
                    <span class="alert-tag optimal" style="background: rgba(16, 185, 129, 0.15); color: var(--accent-green); font-weight: 700;">OK</span>
                </div>
                <div style="color: var(--text-secondary); margin-top:5px; font-size: 13px;">किसी केंद्र पर दवाइयों की कमी नहीं है।</div>
            </div>
        `;
        return;
    }
    
    warnings.sort((a, b) => {
        if (a.status === 'CRITICAL_DEFICIT' && b.status !== 'CRITICAL_DEFICIT') return -1;
        if (a.status !== 'CRITICAL_DEFICIT' && b.status === 'CRITICAL_DEFICIT') return 1;
        return a.days_of_coverage - b.days_of_coverage;
    });

    container.innerHTML = warnings.map(item => {
        const isCritical = item.status === 'CRITICAL_DEFICIT' || item.status === 'STOCKOUT';
        const itemClass = isCritical ? 'critical' : 'warning';
        
        let tagText, medicineLabel, stockLabel, remainingLabel, daysSuffix;
        if (currentLang === 'hi') {
            tagText = isCritical ? 'अति आवश्यक' : 'सामान्य कमी';
            medicineLabel = 'दवा';
            stockLabel = 'स्टॉक';
            remainingLabel = 'बचाव';
            daysSuffix = 'दिन';
        } else {
            tagText = isCritical ? 'CRITICAL' : 'WARNING';
            medicineLabel = 'Medicine';
            stockLabel = 'Stock';
            remainingLabel = 'Remaining';
            daysSuffix = 'Days';
        }
        
        return `
            <div class="alert-item ${itemClass}">
                <div class="alert-item-header">
                    <span style="font-size: 15px; font-weight:700;">${item.phc_name}</span>
                    <span class="alert-tag ${itemClass}">${tagText}</span>
                </div>
                <div style="font-size: 13px; margin: 4px 0;">${medicineLabel}: <strong>${item.medicine_name}</strong> (${item.drug_class})</div>
                <div class="alert-details">
                    <span>${stockLabel}: <strong>${item.current_stock}</strong> ${item.unit}</span>
                    <span>${remainingLabel}: <strong style="color: ${isCritical ? 'var(--accent-red)' : 'var(--accent-yellow)'}">${item.days_of_coverage} ${daysSuffix}</strong></span>
                </div>
            </div>
        `;
    }).join('');
}

function renderMap() {
    const nodesG = document.getElementById('map-nodes');
    if (!nodesG) return;
    
    const phcStates = {};
    for (const item of alertsData) {
        const pid = item.phc_id;
        if (!phcStates[pid]) {
            phcStates[pid] = { name: item.phc_name, worst_status: 'OPTIMAL' };
        }
        
        const status = item.status;
        const current_worst = phcStates[pid].worst_status;
        
        if (status === 'STOCKOUT' || status === 'CRITICAL_DEFICIT') {
            phcStates[pid].worst_status = 'CRITICAL';
        } else if (status === 'WARNING_DEFICIT' && current_worst !== 'CRITICAL') {
            phcStates[pid].worst_status = 'WARNING';
        }
    }
    
    nodesG.innerHTML = Object.entries(coordinates).map(([id, coord]) => {
        const state = phcStates[id] || { worst_status: 'OPTIMAL' };
        let color = 'var(--accent-green)';
        if (state.worst_status === 'CRITICAL') color = 'var(--accent-red)';
        else if (state.worst_status === 'WARNING') color = 'var(--accent-yellow)';
        
        // Build tooltip content dynamically from active database statistics
        const phcMeds = alertsData.filter(item => item.phc_id == id);
        const tooltipText = phcMeds.map(m => `• ${m.medicine_name}: ${m.current_stock} ${m.unit} (${m.days_of_coverage}d coverage)`).join('\n');
        
        return `
            <g class="phc-node" transform="translate(${coord.x}, ${coord.y})" onclick="selectPHCOnMap(${id})">
                <title>${coord.name}\n---\n${tooltipText}</title>
                <circle r="16" fill="none" stroke="${color}" stroke-width="2" opacity="0.3" filter="url(#glow)"/>
                <circle r="8" fill="${color}" />
                <text dx="16" dy="5" text-anchor="start">${coord.name}</text>
            </g>
        `;
    }).join('');
}

function selectPHCOnMap(phcId) {
    document.getElementById('phc-selector').value = phcId;
    switchTab('upload');
}

// ----------------------------------------------------
// OCR LOG UPLOAD & PRESETS
// ----------------------------------------------------
function setupUploadHandlers() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    
    if (!dropZone) return;
    
    dropZone.addEventListener('click', (e) => {
        if (e.target.closest('.phc-select-container')) {
            return;
        }
        fileInput.click();
    });
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--accent-blue)';
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'rgba(255, 255, 255, 0.12)';
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'rgba(255, 255, 255, 0.12)';
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });
}

async function handleFileUpload(file) {
    const progressContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress');
    const progressText = document.getElementById('progress-text');
    const previewContainer = document.getElementById('ocr-preview-container');
    const phcId = document.getElementById('phc-selector').value;
    
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.innerText = currentLang === 'hi' ? "स्टॉक शीट पढ़ना (Gemini AI प्रक्रिया चल रही है...)" : "Reading stock sheet (Gemini AI Processing...)";
    previewContainer.innerHTML = `<div class="preview-placeholder">${currentLang === 'hi' ? 'Gemini 2.5 Flash विज़न OCR छवि को स्कैन कर रहा है...' : 'Gemini 2.5 Flash Vision OCR scanning image...'}</div>`;
    
    loggerSpeak("Stock sheet analysis started", "Started image OCR analysis...");
    
    let progress = 0;
    const interval = setInterval(() => {
        if (progress < 90) {
            progress += Math.floor(Math.random() * 10) + 5;
            progressBar.style.width = `${progress}%`;
        }
    }, 300);
    
    const formData = new FormData();
    formData.append("image", file);
    formData.append("phc_id", phcId);
    
    try {
        const response = await fetch('/api/upload-log', {
            method: 'POST',
            body: formData
        });
        
        clearInterval(interval);
        progressBar.style.width = '100%';
        
        const result = await response.json();
        renderOCRPreview(result);
        
        if (result.status === 'APPROVED') {
            loggerSpeak("Stock successfully approved and committed", "Direct upload approved.");
        } else {
            loggerSpeak("Review required for low confidence OCR.", "Review required for low confidence OCR.");
        }
        
        refreshData();
    } catch (e) {
        clearInterval(interval);
        console.error("OCR analysis failed:", e);
        previewContainer.innerHTML = `<div class="preview-placeholder" style="color: var(--accent-red);">${currentLang === 'hi' ? 'सत्यापन विफल। कृपया नेटवर्क की जाँच करें।' : 'Verification failed. Please check network.'}</div>`;
    }
}

function renderOCRPreview(data) {
    const container = document.getElementById('ocr-preview-container');
    if (!container) return;
    
    const isApproved = data.status === 'APPROVED';
    const indicatorClass = isApproved ? 'high' : 'low';
    const statusText = isApproved ? (currentLang === 'hi' ? 'प्रत्यक्ष अपडेट' : 'Direct Update') : (currentLang === 'hi' ? 'सत्यापन कतार' : 'Review Queue');
    const badgeColor = isApproved ? 'var(--accent-green)' : 'var(--accent-yellow)';
    
    const confidenceText = currentLang === 'hi' ? 'विश्वास स्कोर' : 'Confidence Score';
    const medHeader = currentLang === 'hi' ? 'दवा का नाम' : 'Medicine Name';
    const qtyHeader = currentLang === 'hi' ? 'मात्रा' : 'Quantity';
    const gotoReviewText = currentLang === 'hi' ? '🔍 सत्यापन कतार पर जाएँ' : '🔍 Go to Verification Queue';
    const successMsg = currentLang === 'hi' ? '✔ स्टॉक सफलतापूर्वक डेटाबेस में अपडेट हो गया है।' : '✔ Stock successfully updated in the database.';
    
    const imgHtml = data.image_url ? `
        <div style="margin-bottom: 15px; text-align: center; width: 100%;">
            <img src="${data.image_url}" alt="Uploaded Ledger" 
                 onclick="window.open('${data.image_url}', '_blank')"
                 title="Click to view full image"
                 style="width: 100%; max-height: 180px; object-fit: contain; border-radius: 12px; border: 1px solid var(--border-color); background: #f8fafc; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
        </div>
    ` : '';

    container.innerHTML = `
        ${imgHtml}
        <div style="margin-bottom: 20px;">
            <span class="confidence-indicator ${indicatorClass}">
                ${confidenceText}: ${(data.confidence_score * 100).toFixed(0)}%
            </span>
            <span class="confidence-indicator" style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); color: ${badgeColor}; margin-left: 8px;">
                ${statusText}
            </span>
        </div>
        
        <table class="review-table">
            <thead>
                <tr>
                    <th>${medHeader}</th>
                    <th>${qtyHeader}</th>
                </tr>
            </thead>
            <tbody>
                ${data.items.map(item => `
                    <tr>
                        <td><strong>${item.medicine_name}</strong></td>
                        <td style="font-size: 15px; font-weight:700;">${item.quantity}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        ${!isApproved ? `
            <div style="text-align: right; margin-top: 25px;">
                <button class="btn btn-primary btn-large" onclick="switchTab('review')">
                    ${gotoReviewText}
                </button>
            </div>
        ` : `
            <div style="text-align: center; color: var(--accent-green); font-size:14px; font-weight: 600; margin-top:25px;">
                ${successMsg}
            </div>
        `}
    `;
}

// ----------------------------------------------------
// VERIFICATION HUMAN REVIEW QUEUE
// ----------------------------------------------------
async function loadReviewQueueBadge() {
    try {
        const response = await fetch('/api/review-queue');
        reviewQueue = await response.json();
        const badge = document.getElementById('review-badge');
        if (reviewQueue.length > 0) {
            badge.innerText = reviewQueue.length;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
        
        // Also update the summary strip tile
        const valPending = document.getElementById('val-pending');
        if (valPending) {
            valPending.innerText = reviewQueue.length;
        }
    } catch (e) {
        console.error("Failed loading badge count:", e);
    }
}

async function loadReviewQueue() {
    const container = document.getElementById('review-container');
    if (!container) return;
    
    try {
        const response = await fetch('/api/review-queue');
        reviewQueue = await response.json();
        
        if (reviewQueue.length === 0) {
            container.innerHTML = `<div class="preview-placeholder">${currentLang === 'hi' ? 'पुष्टि के लिए कोई डेटा लंबित नहीं है।' : 'No data pending verification.'}</div>`;
            return;
        }
        
        container.innerHTML = reviewQueue.map(batch => {
            let centerLabel = currentLang === 'hi' ? 'स्वास्थ्य केंद्र' : 'Health Center';
            let confidenceLabel = currentLang === 'hi' ? 'संदेहजनक' : 'Low Confidence';
            let dateLabel = currentLang === 'hi' ? 'दिनांक' : 'Date';
            let medNameLabel = currentLang === 'hi' ? 'दवा का नाम' : 'Medicine Name';
            let qtyLabel = currentLang === 'hi' ? 'मात्रा' : 'Quantity';
            let commitLabel = currentLang === 'hi' ? '✔ डेटा अपडेट करें' : '✔ Commit Record';
            
            return `
                <div class="review-card-item" id="batch-card-${batch.batch_id}">
                    <div class="review-image-pane">
                        <img src="${batch.image_url}" alt="Ledger Reference" 
                             onclick="window.open('${batch.image_url}', '_blank')" 
                             title="Click to view full image" 
                             style="width: 100%; border-radius: 12px; border: 1px solid var(--border-color); max-height: 260px; object-fit: contain; background: #f8fafc; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                    </div>
                    
                    <div class="review-details-pane">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <h4 style="font-size:18px;">${centerLabel}: ${batch.phc_name}</h4>
                            <span class="confidence-indicator low">
                                ${confidenceLabel}: ${(batch.confidence_score * 100).toFixed(0)}%
                            </span>
                        </div>
                        <span style="color: var(--text-secondary); font-size:11px; display:block; margin-bottom:15px;">${dateLabel}: ${batch.created_at}</span>
                        
                        <table class="review-table" id="table-batch-${batch.batch_id}">
                            <thead>
                                <tr>
                                    <th>${medNameLabel}</th>
                                    <th>${qtyLabel}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${batch.items.map((item, idx) => `
                                     <tr>
                                         <td>
                                             <input type="text" 
                                                    value="${item.medicine_name}" 
                                                    id="med-${batch.batch_id}-${idx}"
                                                    style="padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px; font-weight: 600; color: var(--text-primary); background: #ffffff; width: 100%; max-width: 220px; outline: none;">
                                         </td>
                                         <td>
                                             <input type="number" 
                                                    value="${item.quantity}" 
                                                    id="qty-${batch.batch_id}-${idx}"
                                                    style="width: 100px;">
                                         </td>
                                     </tr>
                                 `).join('')}
                            </tbody>
                        </table>
                        
                        <div class="review-actions">
                            <button class="btn btn-success btn-large" onclick="approveBatch('${batch.batch_id}', ${batch.phc_id}, ${batch.items.length})">
                                ${commitLabel}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error("Failed loading review queue:", e);
    }
}

async function approveBatch(batchId, phcId, itemCount) {
    const items = [];
    for (let i = 0; i < itemCount; i++) {
        const qtyInput = document.getElementById(`qty-${batchId}-${i}`);
        const medInput = document.getElementById(`med-${batchId}-${i}`);
        const typedName = medInput.value.trim();
        
        items.push({
            medicine_id: 1, // Will be resolved dynamically by name on backend
            medicine_name: typedName,
            quantity: parseInt(qtyInput.value)
        });
    }
    
    try {
        const response = await fetch('/api/review-queue/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                batch_id: batchId,
                phc_id: phcId,
                items: items
            })
        });
        
        if (response.ok) {
            loggerSpeak("Stock verified and committed successfully", "Stock verified and updated.");
            const card = document.getElementById(`batch-card-${batchId}`);
            if (card) {
                card.style.opacity = '0.2';
                card.style.pointerEvents = 'none';
                setTimeout(() => {
                    loadReviewQueue();
                    refreshData();
                }, 800);
            }
        }
    } catch (e) {
        console.error("Approving review batch failed:", e);
    }
}

// ----------------------------------------------------
// LOGISTICS ROUTING OPTIMIZATION & TTS SPEECH
// ----------------------------------------------------
let ttsData = null;

async function runOptimization() {
    const tbody = document.getElementById('transfers-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = `<tr><td colspan="7" class="text-center">${currentLang === 'hi' ? 'गणितीय समीकरणों द्वारा वितरण मार्ग निकाला जा रहा है...' : 'Solving transportation matrices...'}</td></tr>`;
    loggerSpeak("Calculating optimal distribution routes", "Running transportation solver...");
    
    try {
        const response = await fetch(`/api/optimize?lang=${currentLang}`, { method: 'POST' });
        const result = await response.json();
        
        renderTransfersTable(result.plans);
        renderMapRoutes(result.plans);
        setupTTSAdvisory(result.tts);
    } catch (e) {
        console.error("Optimization failed:", e);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color: var(--accent-red);">${currentLang === 'hi' ? 'सत्यापन विफल। समीकरणों को हल नहीं किया जा सका।' : 'Optimization failed. Unable to solve transportation equations.'}</td></tr>`;
    }
}

function renderTransfersTable(plans) {
    const tbody = document.getElementById('transfers-tbody');
    if (!tbody) return;
    
    if (plans.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color: var(--accent-green);">${currentLang === 'hi' ? 'सभी केंद्र सुरक्षित हैं। किसी दवा को भेजने की आवश्यकता नहीं है।' : 'All centers optimal. No transfers required.'}</td></tr>`;
        return;
    }
    
    tbody.innerHTML = plans.map(p => {
        const isCritical = p.urgency_score >= 5.0;
        const alertClass = isCritical ? 'red' : 'yellow';
        const kmSuffix = currentLang === 'hi' ? ' किमी' : ' km';
        const rationaleLabel = currentLang === 'hi' ? 'तर्क' : 'Rationale';
        
        return `
            <tr>
                <td><span class="status-dot ${alertClass}"></span></td>
                <td>
                    <strong>${p.medicine_name}</strong>
                    ${p.hindi_rationale ? `<div class="rationale-text">💡 <strong>${rationaleLabel}:</strong> ${p.hindi_rationale}</div>` : ''}
                </td>
                <td>${p.source_phc_name}</td>
                <td>${p.target_phc_name}</td>
                <td><strong style="font-size:15px; color:var(--text-primary);">${p.quantity}</strong> ${p.unit}</td>
                <td>${p.distance_km}${kmSuffix}</td>
                <td><strong>${p.impact_score}</strong></td>
            </tr>
        `;
    }).join('');
}

function renderMapRoutes(plans) {
    const routesG = document.getElementById('map-routes');
    if (!routesG) return;
    
    routesG.innerHTML = plans.map(p => {
        const srcCoord = coordinates[p.source_phc_id];
        const tgtCoord = coordinates[p.target_phc_id];
        
        if (!srcCoord || !tgtCoord) return '';
        
        const isCritical = p.urgency_score >= 5.0;
        const color = isCritical ? 'var(--accent-red)' : 'var(--accent-yellow)';
        
        return `
            <line x1="${srcCoord.x}" y1="${srcCoord.y}" 
                  x2="${tgtCoord.x}" y2="${tgtCoord.y}" 
                  stroke="${color}" stroke-width="3" 
                  class="transfer-line" 
                  filter="url(#glow)"/>
        `;
    }).join('');
}

function setupTTSAdvisory(tts) {
    ttsData = tts;
    const bar = document.getElementById('tts-bar');
    const textEl = document.getElementById('tts-text');
    const audioEl = document.getElementById('tts-audio');
    
    bar.style.display = 'flex';
    textEl.innerText = tts.text;
    
    if (tts.audio_url) {
        audioEl.src = `${tts.audio_url}?cb=${Date.now()}`;
        audioEl.load();
    } else {
        audioEl.src = '';
    }
    
    // Always trigger playback automatically so the voice advisory is heard immediately!
    playTTS();
}

function playTTS(isManual = false) {
    if (!ttsData) return;
    
    const audioEl = document.getElementById('tts-audio');
    
    if (ttsData.audio_url && audioEl.src && !ttsData.fallback_to_browser) {
        audioEl.play().catch(e => {
            console.log("Audio autoplay prevented, trigger manually.");
        });
    } else {
        if (!isManual) {
            console.log("Skipping automated SpeechSynthesis to prevent browser queue lockup.");
            return;
        }
        
        let useText = ttsData.text;
        let useLang = ttsData.lang || 'en-US';
        
        // Ensure voice list is pre-loaded or loaded synchronously
        if (speechVoices.length === 0 && window.speechSynthesis) {
            speechVoices = window.speechSynthesis.getVoices();
        }
        
        const safeVoices = speechVoices.filter(v => v && typeof v.lang === 'string');
        
        if (useLang.startsWith('hi')) {
            const hasHindiVoice = safeVoices.some(v => {
                const voiceLang = v.lang.toLowerCase().replace('_', '-');
                return voiceLang.startsWith('hi');
            });
            
            if (!hasHindiVoice) {
                console.warn("No Hindi voice pack detected on this system. Falling back to Romanized Hindi phonetic output.");
                useText = ttsData.text_roman || ttsData.text;
                useLang = 'en-US';
            }
        }
        
        // Speak synchronously to preserve the user gesture context!
        const utterance = new SpeechSynthesisUtterance(useText);
        utterance.lang = useLang;
        utterance.rate = 0.85; // Natural slow speech for older operators
        
        console.log("TTS playTTS() initialized synchronously. Cached voices count:", speechVoices.length, "Target Lang:", useLang);
        speakWithVoice(utterance, speechVoices, useLang);
    }
}

function speakWithVoice(utterance, voices, lang) {
    try {
        const targetLang = (lang || '').toLowerCase().replace('_', '-');
        console.log("Filtering voices for target language:", targetLang);
        
        const voiceList = (voices && voices.length > 0) ? voices : speechVoices;
        const safeVoices = voiceList.filter(v => v && typeof v.lang === 'string');
        
        // 1. Try exact match (e.g. hi-in or en-us)
        let matchedVoice = safeVoices.find(v => {
            const voiceLang = v.lang.toLowerCase().replace('_', '-');
            return voiceLang === targetLang;
        });
        
        // 2. Try prefix match (e.g. starts with hi)
        if (!matchedVoice) {
            const langPrefix = targetLang.split('-')[0];
            matchedVoice = safeVoices.find(v => {
                const voiceLang = v.lang.toLowerCase().replace('_', '-');
                return voiceLang.startsWith(langPrefix);
            });
        }
        
        // 3. Try fuzzy name/lang contains match
        if (!matchedVoice) {
            const langPrefix = targetLang.split('-')[0];
            matchedVoice = safeVoices.find(v => {
                const voiceLang = v.lang.toLowerCase();
                const voiceName = (v.name || '').toLowerCase();
                return voiceLang.includes(langPrefix) || voiceName.includes(langPrefix);
            });
        }
        
        if (matchedVoice) {
            console.log("Selected voice for speech:", matchedVoice.name, matchedVoice.lang);
            utterance.voice = matchedVoice;
        } else {
            console.warn("No matching voice found for", lang, "- using system default.");
        }
    } catch (err) {
        console.error("Error matching voice:", err);
    }
    
    // Retain speech reference in global cache to prevent garbage collection lockup!
    activeUtterances.push(utterance);
    utterance.onend = () => {
        activeUtterances = activeUtterances.filter(u => u !== utterance);
    };
    utterance.onerror = () => {
        activeUtterances = activeUtterances.filter(u => u !== utterance);
    };
    
    // Only cancel the speech queue if there is an active utterance speaking.
    // Calling cancel() on an idle queue in Chromium/Edge corrupts the next synchronous speak() call!
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
    }
    
    try {
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
        console.log("Utterance successfully spoken synchronously.");
    } catch (err) {
        console.error("speechSynthesis.speak failed:", err);
    }
}

async function updateGcpHud() {
    try {
        const response = await fetch('/api/status');
        const status = await response.json();
        
        const modeBadge = document.getElementById('gcp-mode-badge');
        const bqEl = document.getElementById('hud-bq');
        const geminiEl = document.getElementById('hud-gemini');
        const ttsEl = document.getElementById('hud-tts');
        
        if (!modeBadge || !bqEl || !geminiEl || !ttsEl) return;
        
        if (status.mode === 'GCP_LIVE_MODE') {
            modeBadge.innerText = 'GCP LIVE';
            modeBadge.className = 'hud-mode-badge live';
        } else {
            modeBadge.innerText = 'HYBRID DEMO';
            modeBadge.className = 'hud-mode-badge fallback';
        }
        
        if (status.bigquery === 'CONNECTED') {
            bqEl.innerText = 'Connected';
            bqEl.className = 'hud-status connected';
        } else {
            bqEl.innerText = 'Demo Fallback';
            bqEl.className = 'hud-status fallback';
        }
        
        if (status.gemini === 'CONNECTED') {
            geminiEl.innerText = 'Connected';
            geminiEl.className = 'hud-status connected';
        } else {
            geminiEl.innerText = 'Demo Fallback';
            geminiEl.className = 'hud-status fallback';
        }
        
        if (status.tts === 'CONNECTED') {
            ttsEl.innerText = 'Connected';
            ttsEl.className = 'hud-status connected';
        } else {
            ttsEl.innerText = 'Demo Fallback';
            ttsEl.className = 'hud-status fallback';
        }
    } catch (e) {
        console.error("Error updating GCP HUD:", e);
    }
}

function showDemoFeature(featureName) {
    const modal = document.getElementById('demo-modal');
    const title = document.getElementById('modal-feature-title');
    const desc = document.getElementById('modal-feature-desc');
    
    if (!modal || !title || !desc) return;
    
    title.innerText = featureName;
    
    const descriptions = {
        'Doctor Attendance Monitoring': 'Calculates biometric logging history and presence metrics. Present: 92%, Late: 4%, Absent: 4% across the Adilabad district clinics today.',
        'Bed Availability Tracking': 'Tracks daily bed occupancy, ICU beds, and maternity ward allocations. Bed occupancy is currently at 74% with 42 beds available.',
        'Patient Footfall Analytics': 'Analyzes seasonal disease trends, outpatient registrations, and weekly clinic attendance. Patient footfall has spiked +18% due to seasonal monsoon fever patterns.',
        'Custom Reports Generator': 'Generates consolidated district health telemetry reports (PDF/Excel) for submission to the National Health Mission.',
        'System Settings': 'Allows district administrators to configure BQ ML forecast boundaries, emergency thresholds, and TTS speech rate overrides.'
    };
    
    desc.innerText = descriptions[featureName] || 'Accessing integrated module configuration.';
    modal.style.display = 'flex';
}

function closeDemoModal() {
    const modal = document.getElementById('demo-modal');
    if (modal) modal.style.display = 'none';
}

function acceptAiRecommendation() {
    // Switch tab to Route Optimizer and execute the optimization pipeline
    switchTab('transfers');
    // Delay slightly for visual tab-slide transitions
    setTimeout(() => {
        runOptimization();
    }, 500);
}

function navigateToSection(tabId, sectionId) {
    switchTab(tabId);
    setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Visual highlight ring pulse on navigation target
            el.style.outline = '3px solid var(--accent-blue)';
            el.style.outlineOffset = '4px';
            el.style.transition = 'outline 0.3s ease';
            
            setTimeout(() => {
                el.style.outline = '3px solid transparent';
            }, 1500);
        }
    }, 150);
}

const CUSTOM_ALERTS = {
    en: {
        'manage-bed': { title: 'Bed Management', desc: 'Routing emergency bed allocation protocols for Adilabad network.', badge: '🛏️ Bed Telemetry' },
        'crit-bed': { title: 'ICU Bed Alert', desc: 'Critical bed alert sent to district dispatch for immediate action.', badge: '🚨 Critical Alert' },
        'triage-utnoor': { title: 'Triage Details (Utnoor)', desc: 'Triage details: 104 standard Outpatient, 38 Emergency.', badge: '👥 OPD Flow' },
        'triage-indervelly': { title: 'Triage Details (Indervelly)', desc: 'Triage details: 82 Outpatient, 7 Immunizations.', badge: '👥 OPD Flow' },
        'triage-dengue': { title: 'Epidemic Alert', desc: 'Severe Dengue outbreak alerts pushed to state epidemic monitoring.', badge: '🚨 Severe Outbreak' },
        'triage-ichoda': { title: 'Triage Details (Ichoda)', desc: 'Triage details: 95 Outpatient, 10 Referral Wards.', badge: '👥 OPD Flow' },
        'triage-bazar': { title: 'Triage Details (Bazarhatnoor)', desc: 'Triage details: 105 Outpatient, 7 Critical Asthma.', badge: '👥 OPD Flow' },
        'gen-nhm': { title: 'Report Generator', desc: 'Generating NHM Monthly Compliance Report PDF...', badge: '📝 NHM Report' },
        'down-ledger': { title: 'Transfer Ledger', desc: 'Downloading Logistics Redistribution Excel Sheet...', badge: '📊 Logistics Ledger' },
        'save-calib': { title: 'Calibration Saved', desc: 'System Calibration parameters committed successfully.', badge: '⚙️ System Calibration' }
    },
    hi: {
        'manage-bed': { title: 'Bed Management (बेड प्रबंधन)', desc: 'आदिलाबाद नेटवर्क के लिए आपातकालीन बेड आवंटन प्रोटोकॉल लागू किया जा रहा है।', badge: '🛏️ Bed Telemetry' },
        'crit-bed': { title: 'ICU Bed Alert (आईसीयू बेड अलर्ट)', desc: 'जिला प्रेषण (district dispatch) को त्वरित कार्रवाई के लिए गंभीर बेड अलर्ट भेजा गया।', badge: '🚨 Critical Alert' },
        'triage-utnoor': { title: 'Triage Details (Utnoor लक्षण विवरण)', desc: 'लक्षण विवरण: 104 सामान्य ओपीडी (Outpatient), 38 आपातकालीन मरीज।', badge: '👥 OPD Flow' },
        'triage-indervelly': { title: 'Triage Details (Indervelly लक्षण विवरण)', desc: 'लक्षण विवरण: 82 सामान्य ओपीडी, 7 प्रतिरक्षण (Immunizations)।', badge: '👥 OPD Flow' },
        'triage-dengue': { title: 'Epidemic Alert (महामारी प्रकोप चेतावनी)', desc: 'राज्य महामारी निगरानी विभाग को गंभीर डेंगू प्रकोप अलर्ट भेजा गया।', badge: '🚨 Severe Outbreak' },
        'triage-ichoda': { title: 'Triage Details (Ichoda लक्षण विवरण)', desc: 'लक्षण विवरण: 95 सामान्य ओपीडी, 10 रेफरल वार्ड मरीज।', badge: '👥 OPD Flow' },
        'triage-bazar': { title: 'Triage Details (Bazarhatnoor लक्षण विवरण)', desc: 'लक्षण विवरण: 105 सामान्य ओपीडी, 7 गंभीर अस्थमा मरीज।', badge: '👥 OPD Flow' },
        'gen-nhm': { title: 'Report Generator (रिपोर्ट जनरेटर)', desc: 'राष्ट्रीय स्वास्थ्य मिशन (NHM) मासिक अनुपालन रिपोर्ट पीडीएफ जनरेट की जा रही है...', badge: '📝 NHM Report' },
        'down-ledger': { title: 'Transfer Ledger (स्थानांतरण बहीखाता)', desc: 'रसद पुनर्वितरण एक्सेल शीट डाउनलोड की जा रही है...', badge: '📊 Logistics Ledger' },
        'save-calib': { title: 'Calibration Saved (कैलिब्रेशन सुरक्षित)', desc: 'सिस्टम कैलिब्रेशन पैरामीटर सफलतापूर्वक सुरक्षित किए गए।', badge: '⚙️ System Calibration' }
    }
};

function triggerAlert(alertKey) {
    const langAlerts = CUSTOM_ALERTS[currentLang] || CUSTOM_ALERTS['en'];
    const alertData = langAlerts[alertKey];
    if (!alertData) return;
    
    showCustomAlert(alertData.title, alertData.desc, alertData.badge);
}

function showCustomAlert(title, message, badgeText = '🟢 System Notification') {
    const modal = document.getElementById('demo-modal');
    const titleEl = document.getElementById('modal-feature-title');
    const descEl = document.getElementById('modal-feature-desc');
    const badgeEl = modal ? modal.querySelector('.modal-body div[style*="background"]') : null;
    
    if (!modal || !titleEl || !descEl) return;
    
    titleEl.innerText = title;
    descEl.innerText = message;
    if (badgeEl) {
        badgeEl.innerText = badgeText;
    }
    modal.style.display = 'flex';
}

function showCustomConfirm(title, message, onOk) {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-modal-title');
    const descEl = document.getElementById('confirm-modal-desc');
    const cancelBtn = document.getElementById('btn-confirm-cancel');
    const okBtn = document.getElementById('btn-confirm-ok');
    
    if (!modal || !titleEl || !descEl || !cancelBtn || !okBtn) return;
    
    titleEl.innerText = title;
    descEl.innerText = message;
    
    // Set localized button labels
    cancelBtn.innerText = currentLang === 'hi' ? "रद्द करें" : "Cancel";
    okBtn.innerText = currentLang === 'hi' ? "पुष्टि करें" : "Confirm";
    
    modal.style.display = 'flex';
    
    // Clone elements to remove previous event listeners
    const newCancelBtn = cancelBtn.cloneNode(true);
    const newOkBtn = okBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    
    newCancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    newOkBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        onOk();
    });
}

async function flushUploadedDocs() {
    const confirmTitle = currentLang === 'hi' ? "पुष्टि की आवश्यकता है" : "Confirmation Required";
    const confirmMsg = currentLang === 'hi' 
        ? "क्या आप वाकई सभी अपलोड की गई छवियों और सत्यापन कतार को हटाना चाहते हैं?" 
        : "Are you sure you want to flush all uploaded document images and clear the review queue?";
        
    showCustomConfirm(confirmTitle, confirmMsg, async () => {
        try {
            const response = await fetch('/api/upload/flush', { method: 'POST' });
            if (response.ok) {
                const data = await response.json();
                const successTitle = currentLang === 'hi' ? "सफलता" : "Success";
                const successMsg = currentLang === 'hi'
                    ? `सफलतापूर्वक ${data.deleted_files_count} फाइलें और कतार साफ़ की गई!`
                    : `Successfully flushed review queue and deleted ${data.deleted_files_count} files!`;
                loggerSpeak("Uploaded documents flushed successfully", "Cleared all uploaded inventory sheets.");
                
                showCustomAlert(successTitle, successMsg, currentLang === 'hi' ? '🟢 सिस्टम अधिसूचना' : '🟢 System Notification');
                
                // Clear the preview content if any
                const container = document.getElementById('ocr-preview-container');
                if (container) {
                    container.innerHTML = `<div class="preview-placeholder">${currentLang === 'hi' ? 'Upload के बाद extraction परिणाम यहाँ दिखाई देंगे।' : 'Image extraction results will render here after upload.'}</div>`;
                }
                
                // Reload the review queue badge and queue view
                loadReviewQueueBadge();
                loadReviewQueue();
                refreshData();
            } else {
                showCustomAlert(
                    currentLang === 'hi' ? "त्रुटि" : "Error",
                    currentLang === 'hi' ? "फ्लश करने में विफल।" : "Failed to flush uploads.",
                    currentLang === 'hi' ? '🔴 सिस्टम त्रुटि' : '🔴 System Error'
                );
            }
        } catch (e) {
            console.error("Flush uploads failed:", e);
            showCustomAlert(
                currentLang === 'hi' ? "त्रुटि" : "Error",
                currentLang === 'hi' ? "फ्लश करने में विफल।" : "Failed to flush uploads.",
                currentLang === 'hi' ? '🔴 सिस्टम त्रुटि' : '🔴 System Error'
            );
        }
    });
}
