// Vocabulary used to EXPAND search queries. It never generates answer text.
// Hebrew entries map a user's Hebrew wording to the English terms that appear in the manuals.
// Translating a term is not the same as understanding it: the UI always shows which English
// terms were actually searched, so the user can judge the match.

export const STOP_EN = new Set(`a an the of to in on at for from by with without and or but is are was were be been being
do does did can could should would will shall may might must i we you he she it they me my our your this that these those
what which who whom where when why how there here please tell show explain find give info information about regarding
any some all more most other than then so if into onto over under up down out off as it's its is there's
document documents documentation manual's say says said get got need want know look looking
make makes made do doing done happen happens mean means meaning work works working thing things way`.split(/\s+/));

export const STOP_HE = new Set(`איפה היכן מה מהו מהי מהם מהן איך כיצד למה מדוע האם יש אין של על את עם אל גם או אבל כי אם
זה זו זאת אלה אלו הוא היא הם הן אני אנחנו אתה את אתם לי לנו לך שלי שלנו מידע למצוא אפשר צריך רוצה תראה הראה הסבר
תסביר ספר תגיד לגבי בנוגע בעניין כל כמה עוד יותר פחות מאוד רק כבר אחרי לפני בין תוך כאשר מתי שם פה כאן מסמך מסמכים
התיעוד תיעוד בספר בספרים ספר כתוב כתובה כתובים נמצא נמצאת מופיע מופיעה
מוצאים מוצא למצוא עושים עושה לעשות קורה קורים צריכים צריכה נדרש נדרשת נדרשים דרוש בבקשה תודה הזה הזאת האלה דבר משהו אותו אותה כזה סוג`.split(/\s+/));

// Hebrew prefixes (one-letter function words attached to the following word).
export const HE_PREFIXES = ['וכש', 'לכש', 'וה', 'וב', 'ול', 'ומ', 'וש', 'וכ', 'שה', 'שב', 'של', 'מה', 'כש', 'ו', 'ה', 'ב', 'ל', 'מ', 'ש', 'כ'];

// [Hebrew forms separated by |, English search phrases]
export const HE_GLOSSARY = [
  // Power plant
  ['מנוע|מנועים', ['engine']],
  ['כיבוי מנוע|השבתת מנוע|דמימת מנוע', ['engine shutdown', 'engine failure']],
  ['כשל מנוע|תקלת מנוע|איבוד מנוע', ['engine failure', 'engine fail']],
  ['התנעה|התנעת מנוע|הנעה|הנעת מנוע', ['engine start', 'start']],
  ['התנעה באוויר|הנעה באוויר|התנעה בטיסה', ['airstart', 'inflight start', 'air start']],
  ['מהפך דחף|מהפכי דחף|דחף נגדי|ריברס', ['thrust reverser']],
  ['דחף|עוצמה', ['thrust', 'power']],
  ['מצערת|מצערות', ['throttle', 'power lever']],
  ['מצערת אוטומטית', ['autothrottle', 'auto throttle']],
  ['שמן|שמן מנוע', ['oil']],
  ['לחץ שמן', ['oil pressure']],
  ['טמפרטורת שמן', ['oil temperature']],
  ['יחידת כוח עזר|מנוע עזר|אי פי יו', ['apu', 'auxiliary power unit']],
  ['בקר מנוע|פאדק', ['fadec', 'electronic engine control', 'eec']],
  ['רעידות|ויברציות', ['vibration']],
  // Fuel
  ['דלק', ['fuel']],
  ['משאבת דלק|משאבות דלק', ['fuel pump', 'boost pump']],
  ['מיכל דלק|מיכלי דלק|מכל דלק', ['fuel tank', 'tank']],
  ['כמות דלק|מד דלק', ['fuel quantity']],
  ['זרימת דלק|צריכת דלק', ['fuel flow']],
  ['תדלוק', ['refuel', 'refueling', 'fueling']],
  ['ריקון דלק|שאיבת דלק', ['defuel', 'defueling']],
  ['חימום דלק|טמפרטורת דלק', ['fuel temperature', 'fuel heat']],
  ['איזון דלק|העברת דלק', ['fuel balance', 'crossflow', 'intertank']],
  // Electrical
  ['חשמל|חשמלי|חשמלית|מערכת חשמל', ['electrical', 'electrical power']],
  ['גנרטור|גנרטורים|מחולל', ['generator']],
  ['מצבר|מצברים|סוללה|סוללות|בטריה', ['battery']],
  ['אינוורטר|ממיר|ממיר זרם', ['inverter', 'converter']],
  ['ממיר תדר|ממירי תדר', ['frequency converter', 'freq conv']],
  ['פס חשמל|פס|באס', ['bus']],
  ['מפסק|מפסקים|נתיך|נתיכים|מאמ"ת', ['circuit breaker', 'cb']],
  ['זרם חילופין', ['ac', 'alternating current']],
  ['זרם ישר', ['dc', 'direct current']],
  ['חשמל קרקע|כוח קרקע', ['external power', 'ground power']],
  // Hydraulics
  ['הידראוליקה|הידראולי|הידראולית|הידראוליות', ['hydraulic']],
  ['משאבה|משאבות', ['pump']],
  ['משאבה הידראולית', ['hydraulic pump']],
  ['לחץ', ['pressure']],
  ['מצבר הידראולי|אקומולטור', ['accumulator']],
  ['נוזל הידראולי', ['hydraulic fluid', 'hydraulic quantity']],
  // Landing gear & brakes
  ['כן נסע|כני נסע|כנ"ס|גלגלים|גיר', ['landing gear', 'gear']],
  ['גלגל', ['wheel']],
  ['גלגל אף|כן אף', ['nose gear', 'nose wheel', 'nosewheel']],
  ['היגוי גלגל אף|היגוי קרקעי|היגוי', ['nosewheel steering', 'steering']],
  ['צמיג|צמיגים', ['tire', 'tyre']],
  ['בלם|בלמים|בלימה', ['brake']],
  ['בלם חניה|בלם יד', ['parking brake']],
  ['נגד החלקה|אנטי סקיד', ['anti-skid', 'antiskid']],
  ['טמפרטורת בלמים', ['brake temperature', 'btms']],
  // Flight controls
  ['בקרת טיסה|בקרות טיסה|משטחי היגוי|משטחי שליטה', ['flight controls', 'flight control']],
  ['מאזנות|מאזנת', ['aileron']],
  ['הגה גובה', ['elevator']],
  ['הגה כיוון', ['rudder']],
  ['מדפים|מדף|פלאפס|פלפס', ['flaps', 'flap']],
  ['ספוילר|ספוילרים|מעצורי אוויר|בלמי אוויר|ספידברייק', ['spoiler', 'speed brake', 'speedbrake']],
  ['קיזוז|טרים', ['trim']],
  ['שייקר|מזהיר הזדקרות|הזדקרות|סטול', ['stall', 'stick shaker', 'stall warning']],
  ['זווית התקפה', ['angle of attack', 'aoa']],
  ['מנחת יאו|מרסן עלרוד', ['yaw damper']],
  // Autoflight
  ['טייס אוטומטי|אוטופיילוט', ['autopilot']],
  ['מכוון טיסה|פלייט דירקטור', ['flight director']],
  // Navigation & instruments
  ['ניווט', ['navigation']],
  ['מכ"ם|מכם|רדאר|רדאר מזג אוויר|מכ"ם מזג אוויר', ['radar', 'weather radar']],
  ['ג\'י פי אס|לוויני|ניווט לווייני', ['gps', 'gnss']],
  ['מחשב ניווט|מערכת ניהול טיסה', ['fms', 'flight management']],
  ['מד גובה רדיו|רדאר אלטימטר|רדיו אלטימטר', ['radio altimeter']],
  ['מד גובה|אלטימטר', ['altimeter']],
  ['אינרציאלי|מערכת אינרציאלית', ['irs', 'iru', 'inertial reference']],
  ['מצפן', ['compass']],
  ['משיב|טרנספונדר', ['transponder', 'atc transponder']],
  ['מניעת התנגשות|התרעת התנגשות|טיקאס', ['tcas', 'traffic alert']],
  ['התרעת קרקע|התרעת קרבה לקרקע', ['egpws', 'taws', 'ground proximity']],
  ['מכשירים|מכשירי טיסה', ['instruments', 'instrument']],
  ['מסך|מסכים|תצוגה|צג', ['display', 'display unit', 'du']],
  ['תצוגה עילית|ראש למעלה', ['hud', 'head up display']],
  ['ראייה משופרת|ראיית לילה', ['evs', 'enhanced vision']],
  ['מהירות|מהירות אוויר', ['airspeed', 'speed']],
  ['מהירות מקסימלית|מהירות מירבית|מהירות מרבית', ['maximum speed', 'maximum operating speed', 'vmo', 'mmo']],
  ['מקסימלי|מקסימום|מירבי|מרבי', ['maximum']],
  ['מינימלי|מינימום|מזערי', ['minimum']],
  ['גלגלים למטה|גלגלים פתוחים|כן נסע פתוח|גיר למטה', ['landing gear extended', 'gear down', 'vle', 'vlo']],
  ['מערכת נתוני אוויר|מחשב נתוני אוויר', ['air data', 'adc']],
  ['פיטו|צינור פיטו', ['pitot']],
  ['שעון|שעונים', ['clock']],
  // Communication
  ['קשר|תקשורת', ['communication', 'communications']],
  ['רדיו|מכשיר קשר', ['radio']],
  ['קשר לווייני|לווין', ['satcom']],
  ['מקליט קול|מקליט תא טייס', ['cockpit voice recorder', 'cvr']],
  ['רשם טיסה|קופסה שחורה|מקליט נתוני טיסה', ['flight data recorder', 'fdr']],
  ['משדר חירום|מאתר חירום', ['elt', 'emergency locator transmitter']],
  ['אינטרקום|כריזה', ['interphone', 'passenger address', 'pa']],
  ['דאטה לינק|קישור נתונים', ['datalink', 'cpdlc']],
  // Environmental
  ['מיזוג|מיזוג אוויר|מזגן', ['air conditioning', 'ecs']],
  ['פאק|פאקים|יחידת מיזוג', ['pack', 'ecs pack']],
  ['לחץ תא|לחיצות|לחיצת תא|לחץ קבינה', ['pressurization', 'cabin pressure']],
  ['שסתום פליטה|ונטיל פליטה', ['outflow valve']],
  ['גובה תא|גובה קבינה', ['cabin altitude']],
  ['טמפרטורה|טמפרטורות', ['temperature']],
  ['אוויר מדמם|בליד|אוויר דמום', ['bleed air', 'bleed']],
  ['פנאומטיקה|פנאומטי', ['pneumatic']],
  ['שסתום|ונטיל|ברז', ['valve']],
  ['מאוורר|מאווררים', ['fan']],
  ['אוורור', ['ventilation']],
  // Oxygen
  ['חמצן', ['oxygen']],
  ['מסכת חמצן|מסכות חמצן', ['oxygen mask']],
  ['בלון חמצן|מיכל חמצן', ['oxygen cylinder', 'oxygen bottle']],
  // Ice & rain
  ['קרח|הקרחה|התקרחות', ['ice', 'icing']],
  ['נגד קרח|מניעת קרח|אנטי אייס', ['anti-ice', 'anti ice', 'ice protection']],
  ['הפשרה|הסרת קרח|די אייס', ['de-ice', 'deice', 'deicing']],
  ['חימום שמשה|חימום חלונות', ['windshield heat', 'window heat']],
  ['שמשה|חלון|חלונות', ['windshield', 'window']],
  ['גשם|דוחה גשם', ['rain', 'rain repellent']],
  ['מגב|מגבים', ['wiper']],
  ['חימום פיטו|חימום חיישנים', ['probe heat', 'pitot heat']],
  // Fire
  ['אש|שריפה|דליקה', ['fire']],
  ['גלאי אש|גילוי אש', ['fire detection', 'fire detector']],
  ['כיבוי אש|מטף|מטפים|מערכת כיבוי', ['fire extinguisher', 'extinguishing', 'fire bottle']],
  ['עשן|גלאי עשן', ['smoke', 'smoke detector']],
  ['התחממות יתר|חום יתר', ['overheat']],
  // Lights
  ['תאורה|אורות|אור|פנסים', ['lights', 'lighting', 'light']],
  ['פנס נחיתה|אורות נחיתה', ['landing light']],
  ['אורות ניווט', ['navigation lights', 'position lights']],
  ['אורות חירום|תאורת חירום', ['emergency lighting', 'emergency lights']],
  ['אורות התנגשות|מהבהב|סטרוב', ['anti-collision', 'strobe', 'beacon']],
  ['תאורת תא|תאורת קבינה', ['cabin lighting', 'cabin lights']],
  ['פנס יד|פנס', ['flashlight']],
  // Cabin & equipment
  ['דלת|דלתות', ['door']],
  ['דלת ראשית|דלת נוסעים|מדרגות', ['main entrance door', 'airstair']],
  ['יציאת חירום|יציאות חירום|פתח מילוט', ['emergency exit']],
  ['תא מטען|מטען', ['baggage compartment', 'baggage']],
  ['מושב|מושבים|כיסא', ['seat']],
  ['חגורה|חגורות|רתמה', ['seat belt', 'shoulder harness']],
  ['ציוד|ריהוט', ['equipment', 'furnishings']],
  ['ערכה רפואית|עזרה ראשונה|ערכת עזרה ראשונה', ['medical kit', 'first aid kit', 'emk']],
  ['אפוד הצלה|חגורת הצלה', ['life vest', 'life preserver']],
  ['רפסודה|רפסודת הצלה', ['life raft']],
  ['מים', ['water']],
  ['פסולת|שירותים|ביוב', ['waste', 'lavatory', 'toilet']],
  ['מטבח|גלי', ['galley']],
  ['קבינה|תא נוסעים', ['cabin']],
  ['תא טייס|קוקפיט', ['cockpit', 'flight deck']],
  // Warnings & system status
  ['התרעה|התרעות|הודעה|הודעות', ['cas message', 'message', 'alert']],
  ['אזהרה|אזהרות|אדום', ['warning']],
  ['זהירות|צהוב|ענבר|אמבר', ['caution']],
  ['ייעוץ|הודעה מייעצת|כחול', ['advisory']],
  ['תקלה|תקלות|כשל|כשלים|לא עובד|לא תקין|מושבת|דפוק|לא פעיל', ['fail', 'failure', 'inoperative', 'inop', 'malfunction']],
  // Operations & documents
  ['מגבלה|מגבלות|הגבלה|הגבלות', ['limitations', 'limitation', 'limit']],
  ['משקל|משקלים', ['weight']],
  ['משקל המראה מירבי|משקל מירבי', ['maximum takeoff weight', 'mtow', 'maximum weight']],
  ['מרכז כובד|מרכז מסה', ['center of gravity', 'cg']],
  ['גובה', ['altitude']],
  ['גובה מירבי|תקרה', ['maximum altitude', 'maximum operating altitude']],
  ['רוח צד', ['crosswind']],
  ['רוח גב', ['tailwind']],
  ['המראה|המראות', ['takeoff', 'take-off']],
  ['נחיתה|נחיתות', ['landing']],
  ['גישה|גישות|נמיכה', ['approach']],
  ['גישה מוחמצת|גו אראונד|הליכה סביב', ['go-around', 'go around', 'missed approach']],
  ['טיפוס', ['climb']],
  ['ירידה|הנמכה', ['descent']],
  ['ירידת חירום', ['emergency descent']],
  ['שיוט', ['cruise']],
  ['הסעה|טקסי', ['taxi']],
  ['מסלול|מסלולים', ['runway']],
  ['ביצועים', ['performance']],
  ['טבלה|טבלאות|תרשים|גרף', ['table', 'chart']],
  ['נוהל|נהלים|פרוצדורה', ['procedure', 'procedures']],
  ['נוהל חירום|נהלי חירום|חירום', ['emergency procedure', 'emergency']],
  ['נוהל חריג|נהלים חריגים|לא שגרתי', ['abnormal procedure', 'abnormal']],
  ['נוהל רגיל|נהלים רגילים|שגרתי', ['normal procedure', 'normal']],
  ['רשימת תיוג|צ\'קליסט|צקליסט', ['checklist']],
  ['שיגור|יציאה לטיסה|אישור טיסה', ['dispatch']],
  ['ציוד מינימלי|רשימת ציוד מינימלי|ממל|מל', ['mmel', 'mel', 'minimum equipment list']],
  ['קטגוריית תיקון|זמן תיקון', ['repair category', 'repair interval']],
  ['שלט|שילוט|מדבקה|פלקרד', ['placard', 'placarding']],
  ['תחזוקה|אחזקה|טכנאי', ['maintenance']],
  ['מבצעי|תפעולי', ['operational']],
  ['הגדרה|הגדרות|מושגים', ['definitions', 'definition']],
  ['קיצור|קיצורים|ראשי תיבות', ['abbreviations', 'acronyms']],
  ['טיסה מעל מים|מעל ים', ['overwater', 'extended overwater']],
  ['טווח מורחב|טיסה ארוכה|אי טופס', ['etops', 'extended range', 'er']],
  ['טיסה בלילה|לילה', ['night']],
  ['מזג אוויר|מז"א', ['weather']],
  ['ערבול|מערבולות', ['turbulence']],
  ['רחפת|גלישה', ['glide']],
  ['תא נוסעים לחוץ|ללא לחיצות', ['unpressurized']],
];

// Base aviation abbreviations. At import time, abbreviation lists mined from the installed
// documents themselves are added to this (see passages.js → mineAbbreviations).
export const ABBREV = {
  APU: 'auxiliary power unit', AFM: 'airplane flight manual', AOM: 'airplane operating manual', MEL: 'minimum equipment list',
  MMEL: 'master minimum equipment list', MOPP: 'maintenance operational placarding procedures', CAS: 'crew alerting system',
  ECS: 'environmental control system', FMS: 'flight management system', IRS: 'inertial reference system', IRU: 'inertial reference unit',
  TCAS: 'traffic alert and collision avoidance system', EGPWS: 'enhanced ground proximity warning system', TAWS: 'terrain awareness warning system',
  ELT: 'emergency locator transmitter', CVR: 'cockpit voice recorder', FDR: 'flight data recorder', HUD: 'head up display',
  EVS: 'enhanced vision system', FADEC: 'full authority digital engine control', EEC: 'electronic engine control', CG: 'center of gravity',
  CB: 'circuit breaker', DU: 'display unit', ADC: 'air data computer', AOA: 'angle of attack', RA: 'radio altimeter',
  BTMS: 'brake temperature monitoring system', INOP: 'inoperative', MTOW: 'maximum takeoff weight', MLW: 'maximum landing weight',
  MZFW: 'maximum zero fuel weight', VMO: 'maximum operating speed', MMO: 'maximum operating mach', ER: 'extended range',
  ADLS: 'aircraft data log sheet', AMM: 'aircraft maintenance manual', PDB: 'power distribution box', GPU: 'ground power unit',
  EMK: 'emergency medical kit', HF: 'high frequency', VHF: 'very high frequency', SATCOM: 'satellite communication',
  FD: 'flight director', AP: 'autopilot', AT: 'autothrottle', EICAS: 'engine indicating crew alerting system',
};

// Equivalent English wordings found across manuals.
export const SYNONYMS = [
  ['inoperative', 'inop', 'failed', 'fail', 'failure', 'malfunction'],
  ['anti-ice', 'anti ice', 'ice protection'],
  ['de-ice', 'deice', 'deicing'],
  ['airplane', 'aircraft'],
  ['takeoff', 'take-off', 'take off'],
  ['go-around', 'go around'],
  ['speed brake', 'speedbrake', 'spoiler'],
  ['nosewheel', 'nose wheel'],
  ['windshield', 'windscreen'],
  ['limitations', 'limits', 'limit'],
  ['fire extinguisher', 'fire bottle', 'extinguishing'],
  ['autopilot', 'a/p'],
  ['autothrottle', 'a/t', 'auto throttle'],
];

export const FAULT_WORDS_EN = /\b(fail(ed|ure|s)?|inop(erative)?|malfunction\w*|fault\w*|warning|caution|leak\w*|smoke|fire|overheat\w*|lost|loss)\b/i;
export const FAULT_WORDS_HE = /(תקל|כשל|לא עובד|לא תקין|מושבת|נכשל|אזהר|דליפ|עשן|שריפ|אש\b|התחממות)/;
