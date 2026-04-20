import type {
  AssessmentQuestion,
  AssessmentTopic,
  AssessmentQuizKind,
  Difficulty,
  QuestionTrack,
} from "@/types/assessment";
import { validateQuestionBankTransliteration } from "@/lib/quiz/transliteration";

interface PlacementSeed {
  id: string;
  track: QuestionTrack;
  topic: AssessmentTopic;
  difficulty: Difficulty;
  thai: string;
  translit: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}

interface AudioChoiceSeed {
  thai: string;
  translit: string;
  english: string;
}

function createChoiceId(questionId: string, index: number) {
  return `${questionId}-c${index + 1}`;
}

function toDeterministicOffset(questionId: string) {
  return [...questionId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4;
}

function rotateChoiceStrings(
  questionId: string,
  choices: readonly string[],
  correctIndex: number
) {
  const offset = toDeterministicOffset(questionId);
  const rotated = choices.map((_, index) => choices[(index + offset) % choices.length]);
  const rotatedCorrectIndex = (correctIndex - offset + choices.length) % choices.length;

  return {
    rotated,
    rotatedCorrectIndex,
  };
}

function rotateAudioChoices(
  questionId: string,
  choices: readonly AudioChoiceSeed[],
  correctIndex: number
) {
  const offset = toDeterministicOffset(questionId);
  const rotated = choices.map((_, index) => choices[(index + offset) % choices.length]);
  const rotatedCorrectIndex = (correctIndex - offset + choices.length) % choices.length;

  return {
    rotated,
    rotatedCorrectIndex,
  };
}

const placementSeed: PlacementSeed[] = [
  { id: "G01", track: "both", topic: "greetings", difficulty: 1, thai: "สวัสดี", translit: "sà-wàt-dii", choices: ["Hello", "Thank you", "Sorry", "Goodbye"], correctIndex: 0 },
  { id: "G02", track: "both", topic: "politeness", difficulty: 1, thai: "ขอบคุณครับ/ค่ะ", translit: "khàawp-khun khráp/khâ", choices: ["Sorry", "Thank you", "Excuse me", "It’s okay"], correctIndex: 1 },
  { id: "G03", track: "both", topic: "politeness", difficulty: 1, thai: "ขอโทษ", translit: "khǎaw-thôot", choices: ["Sorry", "Delicious", "Hurry up", "Where?"], correctIndex: 0 },
  { id: "G04", track: "both", topic: "politeness", difficulty: 2, thai: "ไม่เป็นไร", translit: "mâi bpen-rai", choices: ["No problem", "I don’t know", "Not yet", "Very good"], correctIndex: 0 },
  { id: "G05", track: "both", topic: "greetings", difficulty: 2, thai: "ยินดีที่ได้รู้จัก", translit: "yin-dii thîi-dâi rúu-jàk", choices: ["Nice to meet you", "See you tomorrow", "Long time no see", "Please repeat"], correctIndex: 0 },
  { id: "G08", track: "both", topic: "politeness", difficulty: 3, thai: "รบกวนหน่อยได้ไหม", translit: "róp-guuan nòi dâai-mǎi", choices: ["Can I bother you?", "I’m hungry", "How much is it?", "Where is it?"], correctIndex: 0 },
  { id: "G09", track: "both", topic: "politeness", difficulty: 3, thai: "พูดช้าๆหน่อยได้ไหม", translit: "phûut cháa-cháa nòi dâai-mǎi", choices: ["Can you speak slowly?", "Can you speak louder?", "Can you write it?", "Can you translate?"], correctIndex: 0 },
  { id: "G10", track: "both", topic: "politeness", difficulty: 3, thai: "พูดอีกครั้งได้ไหม", translit: "phûut ìik khráng dâai-mǎi", choices: ["Can you say it again?", "Can you say it quietly?", "Can you say it later?", "Can you say it in Thai?"], correctIndex: 0 },
  { id: "G11", track: "both", topic: "politeness", difficulty: 3, thai: "เข้าใจแล้ว", translit: "khâo-jai láew", choices: ["I understand", "I’m lost", "I’m finished", "I’m joking"], correctIndex: 0 },
  { id: "G12", track: "both", topic: "politeness", difficulty: 4, thai: "ไม่เข้าใจครับ/ค่ะ ช่วยอธิบายหน่อยได้ไหม", translit: "mâi khâo-jai khráp/khâ chûay à-thí-baai nòi dâai-mǎi", choices: ["I don’t understand, can you explain?", "I don’t like it, can you change it?", "I’m not ready, can you wait?", "I’m not sure, can you guess?"], correctIndex: 0 },

  { id: "S01", track: "both", topic: "self_intro", difficulty: 1, thai: "ฉันชื่อ…", translit: "chǎn chûue …", choices: ["My name is…", "I am from…", "I live in…", "I like…"], correctIndex: 0 },
  { id: "S02", track: "both", topic: "self_intro", difficulty: 1, thai: "ฉันมาจากอังกฤษ", translit: "chǎn maa-jàak ang-grìt", choices: ["I’m from England", "I’m going to England", "I like England", "I speak English"], correctIndex: 0 },
  { id: "S03", track: "both", topic: "basics", difficulty: 1, thai: "ใช่", translit: "châi", choices: ["Yes", "No", "Maybe", "Not yet"], correctIndex: 0 },
  { id: "S04", track: "both", topic: "basics", difficulty: 1, thai: "ไม่ใช่", translit: "mâi châi", choices: ["Not yes", "Not correct", "Not now", "Not here"], correctIndex: 1 },
  { id: "S05", track: "both", topic: "basics", difficulty: 1, thai: "ไม่", translit: "mâi", choices: ["No", "Yes", "Very", "But"], correctIndex: 0 },
  { id: "S06", track: "both", topic: "basics", difficulty: 2, thai: "ฉันอยู่กรุงเทพฯ", translit: "chǎn yùu grung-thêep", choices: ["I live in Bangkok", "I like Bangkok", "I’m going to Bangkok", "Bangkok is big"], correctIndex: 0 },
  { id: "S07", track: "both", topic: "basics", difficulty: 2, thai: "ฉันเป็นครู", translit: "chǎn bpen khruu", choices: ["I’m a teacher", "I have a teacher", "I like teaching", "I teach Thai"], correctIndex: 0 },
  { id: "S08", track: "both", topic: "basics", difficulty: 3, thai: "ฉันพูดภาษาไทยได้นิดหน่อย", translit: "chǎn phûut phaa-sǎa thai dâai nít-nòi", choices: ["I can speak a little Thai", "I can’t speak Thai", "I speak Thai every day", "Thai is a little hard"], correctIndex: 0 },
  { id: "S09", track: "both", topic: "basics", difficulty: 3, thai: "คุณทำงานอะไร", translit: "khun tam-ngaan à-rai", choices: ["What do you do for work?", "Where do you work?", "When do you work?", "Why do you work?"], correctIndex: 0 },
  { id: "S10", track: "both", topic: "basics", difficulty: 4, thai: "วันนี้คุณว่างไหม", translit: "wan-níi khun wâang mǎi", choices: ["Are you free today?", "Are you tired today?", "Are you here today?", "Are you okay today?"], correctIndex: 0 },

  { id: "N01", track: "both", topic: "numbers", difficulty: 1, thai: "หนึ่ง", translit: "nʉ̀ng", choices: ["1", "2", "5", "10"], correctIndex: 0 },
  { id: "N02", track: "both", topic: "numbers", difficulty: 1, thai: "สอง", translit: "sǎawng", choices: ["2", "3", "4", "6"], correctIndex: 0 },
  { id: "N03", track: "both", topic: "numbers", difficulty: 1, thai: "สิบ", translit: "sìp", choices: ["10", "20", "7", "100"], correctIndex: 0 },
  { id: "N04", track: "both", topic: "numbers", difficulty: 2, thai: "ยี่สิบ", translit: "yîi-sìp", choices: ["20", "12", "30", "200"], correctIndex: 0 },
  { id: "N05", track: "both", topic: "numbers", difficulty: 2, thai: "หนึ่งร้อย", translit: "nʉ̀ng rɔ́ɔi", choices: ["100", "1,000", "10", "101"], correctIndex: 0 },
  { id: "N06", track: "both", topic: "shopping", difficulty: 2, thai: "เท่าไหร่", translit: "thâo-rài", choices: ["How much?", "How many?", "Where?", "Which one?"], correctIndex: 0 },
  { id: "N07", track: "both", topic: "shopping", difficulty: 2, thai: "แพง", translit: "phɛ́ɛng", choices: ["Expensive", "Cheap", "Beautiful", "Big"], correctIndex: 0 },
  { id: "N08", track: "both", topic: "shopping", difficulty: 2, thai: "ถูก", translit: "thùuk", choices: ["Cheap", "Correct", "Wrong", "Same"], correctIndex: 0 },
  { id: "N09", track: "both", topic: "shopping", difficulty: 3, thai: "ลดได้ไหม", translit: "lót dâai-mǎi", choices: ["Can you discount?", "Can you deliver?", "Can you wait?", "Can you change it?"], correctIndex: 0 },
  { id: "N10", track: "both", topic: "shopping", difficulty: 3, thai: "เอาอันนี้", translit: "ao an-níi", choices: ["I’ll take this one", "I want to try this", "I’m looking for this", "I don’t like this"], correctIndex: 0 },
  { id: "N11", track: "both", topic: "shopping", difficulty: 3, thai: "มีไซส์ใหญ่ไหม", translit: "mii sái yài mǎi", choices: ["Do you have a bigger size?", "Do you have another color?", "Do you have it cheaper?", "Do you have a receipt?"], correctIndex: 0 },
  { id: "N12", track: "both", topic: "shopping", difficulty: 3, thai: "ขอถุงด้วย", translit: "khǎaw thǔng dûay", choices: ["A bag please", "Water please", "Receipt please", "Help please"], correctIndex: 0 },
  { id: "N13", track: "both", topic: "shopping", difficulty: 4, thai: "รับบัตรเครดิตไหม", translit: "ráp bàt khrée-dit mǎi", choices: ["Do you take credit cards?", "Do you have change?", "Do you have a menu?", "Do you have Wi-Fi?"], correctIndex: 0 },
  { id: "N14", track: "both", topic: "shopping", difficulty: 4, thai: "ขอใบเสร็จด้วยครับ/ค่ะ", translit: "khǎaw bai-sèt dûay khráp/khâ", choices: ["Can I have a receipt?", "Can I have a discount?", "Can I have a bag?", "Can I have a refund?"], correctIndex: 0 },

  { id: "T01", track: "both", topic: "time", difficulty: 1, thai: "วันนี้", translit: "wan-níi", choices: ["Today", "Tomorrow", "Yesterday", "Morning"], correctIndex: 0 },
  { id: "T02", track: "both", topic: "time", difficulty: 1, thai: "พรุ่งนี้", translit: "phrûng-níi", choices: ["Tomorrow", "Today", "Next week", "Later"], correctIndex: 0 },
  { id: "T03", track: "both", topic: "time", difficulty: 1, thai: "เมื่อวาน", translit: "mûuea-waan", choices: ["Yesterday", "Last year", "Tonight", "Early"], correctIndex: 0 },
  { id: "T04", track: "both", topic: "time", difficulty: 2, thai: "ตอนนี้", translit: "dtawn-níi", choices: ["Now", "Later", "Always", "Never"], correctIndex: 0 },
  { id: "T05", track: "both", topic: "time", difficulty: 2, thai: "เช้า", translit: "cháo", choices: ["Morning", "Evening", "Night", "Noon"], correctIndex: 0 },
  { id: "T08", track: "both", topic: "days", difficulty: 2, thai: "วันเสาร์", translit: "wan-sǎo", choices: ["Saturday", "Sunday", "Thursday", "Wednesday"], correctIndex: 0 },
  { id: "T09", track: "both", topic: "time", difficulty: 3, thai: "กี่โมง", translit: "gii moong", choices: ["What time?", "What day?", "How long?", "How often?"], correctIndex: 0 },
  { id: "T10", track: "both", topic: "scheduling", difficulty: 3, thai: "เจอกันกี่โมง", translit: "jer-gan gii moong", choices: ["What time shall we meet?", "Where shall we meet?", "Who shall we meet?", "When did we meet?"], correctIndex: 0 },
  { id: "T11", track: "both", topic: "scheduling", difficulty: 4, thai: "คุณสะดวกวันไหน", translit: "khun sà-dùuak wan-nǎi", choices: ["What day is convenient for you?", "What day is it today?", "What day is your birthday?", "What day do you work?"], correctIndex: 0 },
  { id: "T12", track: "both", topic: "scheduling", difficulty: 4, thai: "ขอเลื่อนไปสัปดาห์หน้าได้ไหม", translit: "khǎaw lʉ̂an bpai sàp-daa nâa dâai-mǎi", choices: ["Can we postpone to next week?", "Can we do it next month?", "Can we cancel today?", "Can we meet earlier?"], correctIndex: 0 },

  { id: "D01", track: "both", topic: "directions", difficulty: 1, thai: "ซ้าย", translit: "sáai", choices: ["Left", "Right", "Straight", "Near"], correctIndex: 0 },
  { id: "D02", track: "both", topic: "directions", difficulty: 1, thai: "ขวา", translit: "khwǎa", choices: ["Right", "Left", "Behind", "Inside"], correctIndex: 0 },
  { id: "D04", track: "both", topic: "directions", difficulty: 2, thai: "ใกล้", translit: "glâi", choices: ["Near", "Far", "Early", "Late"], correctIndex: 0 },
  { id: "D05", track: "both", topic: "directions", difficulty: 2, thai: "ไกล", translit: "glāi", choices: ["Far", "Near", "Fast", "Slow"], correctIndex: 0 },
  { id: "D06", track: "both", topic: "directions", difficulty: 3, thai: "อยู่ที่ไหน", translit: "yùu thîi-nǎi", choices: ["Where is it?", "What is it?", "Who is it?", "Why is it?"], correctIndex: 0 },
  { id: "D07", track: "both", topic: "transport", difficulty: 2, thai: "รถไฟฟ้า", translit: "rót-fai-fáa", choices: ["Skytrain", "Taxi", "Boat", "Bus"], correctIndex: 0 },
  { id: "D08", track: "both", topic: "transport", difficulty: 2, thai: "แท็กซี่", translit: "thɛ́k-sîi", choices: ["Taxi", "Train", "Plane", "Motorbike"], correctIndex: 0 },
  { id: "D09", track: "both", topic: "transport", difficulty: 3, thai: "ไป…ได้ไหม", translit: "bpai … dâai-mǎi", choices: ["Can you go to…?", "Can you come from…?", "Can you wait at…?", "Can you stop at…?"], correctIndex: 0 },
  { id: "D10", track: "both", topic: "transport", difficulty: 3, thai: "ไปสยามครับ/ค่ะ", translit: "bpai sà-yǎam khráp/khâ", choices: ["To Siam, please", "I’m from Siam", "Siam is near", "I like Siam"], correctIndex: 0 },
  { id: "D11", track: "both", topic: "transport", difficulty: 4, thai: "จอดตรงนี้ได้ไหม", translit: "jàawt dtrong-níi dâai-mǎi", choices: ["Can you stop here?", "Can you turn here?", "Can you park there?", "Can you go now?"], correctIndex: 0 },
  { id: "D12", track: "both", topic: "transport", difficulty: 4, thai: "รถติดมาก", translit: "rót-dtìt mâak", choices: ["Traffic is very bad", "The car is very big", "The road is very long", "The bus is very slow"], correctIndex: 0 },
  { id: "D13", track: "both", topic: "directions", difficulty: 4, thai: "เดินไปได้ไหม", translit: "dəən bpai dâai-mǎi", choices: ["Can I walk there?", "Can I run there?", "Can I drive there?", "Can I swim there?"], correctIndex: 0 },
  { id: "D14", track: "both", topic: "directions", difficulty: 5, thai: "จากที่นี่ไป…ไกลไหม", translit: "jàak thîi-níi bpai … glāi mǎi", choices: ["Is it far from here to…?", "Is it expensive to go to…?", "Is it open today?", "Is it safe here?"], correctIndex: 0 },

  { id: "F01", track: "both", topic: "food", difficulty: 1, thai: "หิว", translit: "hǐw", choices: ["Hungry", "Full", "Tired", "Thirsty"], correctIndex: 0 },
  { id: "F02", track: "both", topic: "food", difficulty: 1, thai: "อร่อย", translit: "à-ròi", choices: ["Delicious", "Spicy", "Sweet", "Sour"], correctIndex: 0 },
  { id: "F03", track: "both", topic: "food", difficulty: 2, thai: "เผ็ด", translit: "phèt", choices: ["Spicy", "Salty", "Sweet", "Bitter"], correctIndex: 0 },
  { id: "F04", track: "both", topic: "food", difficulty: 2, thai: "ไม่เผ็ด", translit: "mâi phèt", choices: ["Not spicy", "Very spicy", "A little spicy", "Too spicy"], correctIndex: 0 },
  { id: "F05", track: "both", topic: "food", difficulty: 2, thai: "น้ำ", translit: "náam", choices: ["Water", "Rice", "Soup", "Ice"], correctIndex: 0 },
  { id: "F06", track: "both", topic: "ordering", difficulty: 2, thai: "ขอ…หนึ่งที่", translit: "khǎaw … nʉ̀ng thîi", choices: ["One portion of… please", "One minute please", "One table please", "One bag please"], correctIndex: 0 },
  { id: "F08", track: "both", topic: "ordering", difficulty: 3, thai: "ขอเมนูหน่อยครับ/ค่ะ", translit: "khǎaw mee-nuu nòi khráp/khâ", choices: ["Can I have the menu?", "Can I have the bill?", "Can I have water?", "Can I have a discount?"], correctIndex: 0 },
  { id: "F09", track: "both", topic: "ordering", difficulty: 3, thai: "กินที่นี่หรือกลับบ้าน", translit: "gin thîi-níi rʉ̌ʉ glàp bâan", choices: ["Eat here or take away?", "Eat now or later?", "Eat rice or noodles?", "Eat spicy or not?"], correctIndex: 0 },
  { id: "F10", track: "both", topic: "ordering", difficulty: 3, thai: "กลับบ้าน", translit: "glàp bâan", choices: ["Take away", "Eat here", "Pay now", "Come back"], correctIndex: 0 },
  { id: "F11", track: "both", topic: "ordering", difficulty: 4, thai: "ขอไม่ใส่ผักชี", translit: "khǎaw mâi sài phàk-chii", choices: ["No coriander, please", "No chili, please", "No fish sauce, please", "No sugar, please"], correctIndex: 0 },
  { id: "F12", track: "both", topic: "ordering", difficulty: 4, thai: "เอาเผ็ดน้อย", translit: "ao phèt nòi", choices: ["A little spicy", "Not spicy", "Very spicy", "Spicy later"], correctIndex: 0 },
  { id: "F13", track: "both", topic: "ordering", difficulty: 4, thai: "ขอเช็คบิลด้วย", translit: "khǎaw chék-bin dûay", choices: ["Can I have the bill?", "Can I have change?", "Can I have a menu?", "Can I have a bag?"], correctIndex: 0 },
  { id: "F14", track: "both", topic: "ordering", difficulty: 5, thai: "แพ้อาหารทะเล", translit: "phɛ́ɛ aa-hǎan thaa-lay", choices: ["I’m allergic to seafood", "I don’t like seafood", "I want seafood", "Seafood is expensive"], correctIndex: 0 },

  { id: "Q01", track: "both", topic: "question_words", difficulty: 1, thai: "อะไร", translit: "à-rai", choices: ["What", "Where", "When", "Why"], correctIndex: 0 },
  { id: "Q02", track: "both", topic: "question_words", difficulty: 1, thai: "ที่ไหน", translit: "thîi-nǎi", choices: ["Where", "What", "When", "Which"], correctIndex: 0 },
  { id: "Q03", track: "both", topic: "question_words", difficulty: 1, thai: "เมื่อไหร่", translit: "mûuea-rài", choices: ["When", "Where", "How", "Who"], correctIndex: 0 },
  { id: "Q06", track: "both", topic: "particles", difficulty: 2, thai: "ไหม", translit: "mǎi", choices: ["Question marker", "Past tense", "Plural marker", "Future marker"], correctIndex: 0 },
  { id: "Q07", track: "both", topic: "particles", difficulty: 2, thai: "ครับ/ค่ะ", translit: "khráp/khâ", choices: ["Polite ending", "Negative marker", "Question word", "Classifier"], correctIndex: 0 },
  { id: "Q08", track: "both", topic: "grammar", difficulty: 3, thai: "คุณชอบอะไร", translit: "khun châawp à-rai", choices: ["What do you like?", "Do you like it?", "Why do you like it?", "Where do you like?"], correctIndex: 0 },
  { id: "Q09", track: "both", topic: "grammar", difficulty: 3, thai: "คุณไปไหนมา", translit: "khun bpai nǎi maa", choices: ["Where have you been?", "Where are you going?", "Where are you?", "Where did you buy it?"], correctIndex: 0 },
  { id: "Q10", track: "both", topic: "grammar", difficulty: 4, thai: "ยังไม่ได้", translit: "yang mâi dâai", choices: ["Not yet", "Already", "Always", "Never"], correctIndex: 0 },
  { id: "Q11", track: "both", topic: "grammar", difficulty: 4, thai: "ได้แล้ว", translit: "dâai láew", choices: ["Got it", "Not possible", "Too late", "Not sure"], correctIndex: 0 },
  { id: "Q12", track: "both", topic: "grammar", difficulty: 5, thai: "เคยไปไหม", translit: "kəəy bpai mǎi", choices: ["Have you ever been?", "Will you go?", "Did you go yesterday?", "Are you going now?"], correctIndex: 0 },

  { id: "L01", track: "both", topic: "family", difficulty: 2, thai: "แม่", translit: "mâae", choices: ["Mother", "Father", "Sister", "Brother"], correctIndex: 0 },
  { id: "L02", track: "both", topic: "family", difficulty: 2, thai: "พ่อ", translit: "phâaw", choices: ["Father", "Mother", "Uncle", "Aunt"], correctIndex: 0 },
  { id: "L03", track: "both", topic: "family", difficulty: 2, thai: "พี่", translit: "phîi", choices: ["Older sibling", "Younger sibling", "Friend", "Teacher"], correctIndex: 0 },
  { id: "L04", track: "both", topic: "family", difficulty: 2, thai: "น้อง", translit: "náawng", choices: ["Younger sibling", "Older sibling", "Boss", "Student"], correctIndex: 0 },
  { id: "L05", track: "both", topic: "daily_life", difficulty: 2, thai: "บ้าน", translit: "bâan", choices: ["Home", "School", "Market", "Hospital"], correctIndex: 0 },
  { id: "L07", track: "both", topic: "daily_life", difficulty: 3, thai: "คุณอยู่กับใคร", translit: "khun yùu gàp khrai", choices: ["Who do you live with?", "Where do you live?", "Who are you?", "Who is that?"], correctIndex: 0 },
  { id: "L08", track: "both", topic: "daily_life", difficulty: 3, thai: "ฉันอยู่คนเดียว", translit: "chǎn yùu khon-diao", choices: ["I live alone", "I am alone now", "I am lonely", "I am single (relationship)"], correctIndex: 0 },
  { id: "L09", track: "both", topic: "daily_life", difficulty: 4, thai: "วันนี้ทำอะไรบ้าง", translit: "wan-níi tam à-rai bâang", choices: ["What have you been doing today?", "What do you want today?", "What time today?", "Where today?"], correctIndex: 0 },
  { id: "L10", track: "both", topic: "daily_life", difficulty: 4, thai: "พรุ่งนี้มีแผนไหม", translit: "phrûng-níi mii phɛ̌ɛn mǎi", choices: ["Do you have plans tomorrow?", "Are you free tomorrow?", "Do you work tomorrow?", "Do you travel tomorrow?"], correctIndex: 0 },

  { id: "V01", track: "both", topic: "verbs", difficulty: 2, thai: "ชอบ", translit: "châawp", choices: ["Like", "Need", "Forget", "Choose"], correctIndex: 0 },
  { id: "V02", track: "both", topic: "verbs", difficulty: 2, thai: "อยาก", translit: "yàak", choices: ["Want", "Have", "Can", "Go"], correctIndex: 0 },
  { id: "V03", track: "both", topic: "verbs", difficulty: 3, thai: "ต้องการ", translit: "dtâwng-gaan", choices: ["Need / want", "Understand", "Repeat", "Wait"], correctIndex: 0 },
  { id: "V04", track: "both", topic: "verbs", difficulty: 3, thai: "ช่วยพิมพ์ให้หน่อย", translit: "chûay phim hâi nòi", choices: ["Please type it for me", "Please bring me there", "Please show me this", "Please speak faster"], correctIndex: 0 },
  { id: "V05", track: "both", topic: "verbs", difficulty: 3, thai: "ช่วยแปลหน่อย", translit: "chûay bplɛɛ nòi", choices: ["Please translate", "Please call me", "Please sit down", "Please write bigger"], correctIndex: 0 },
  { id: "V06", track: "both", topic: "verbs", difficulty: 4, thai: "ขอถามหน่อยได้ไหม", translit: "khǎaw thǎam nòi dâai-mǎi", choices: ["Can I ask something?", "Can I leave now?", "Can I pay first?", "Can I choose this?"], correctIndex: 0 },
  { id: "V07", track: "both", topic: "verbs", difficulty: 4, thai: "ลองพูดอีกที", translit: "laawng phûut ìik thii", choices: ["Try saying it again", "Try writing it now", "Try listening first", "Try waiting outside"], correctIndex: 0 },
  { id: "V08", track: "both", topic: "verbs", difficulty: 4, thai: "เขียนช้าๆหน่อย", translit: "khǐan cháa-cháa nòi", choices: ["Please write slowly", "Please walk slowly", "Please eat slowly", "Please open slowly"], correctIndex: 0 },

  { id: "A01", track: "both", topic: "adjectives", difficulty: 2, thai: "ดีมาก", translit: "dii mâak", choices: ["Very good", "Very bad", "Very cheap", "Very fast"], correctIndex: 0 },
  { id: "A02", track: "both", topic: "adjectives", difficulty: 2, thai: "ช้ามาก", translit: "cháa mâak", choices: ["Very slow", "Very quick", "Very hot", "Very cold"], correctIndex: 0 },
  { id: "A03", track: "both", topic: "adjectives", difficulty: 3, thai: "แพงมาก", translit: "phɛɛng mâak", choices: ["Very expensive", "Very cheap", "Very loud", "Very easy"], correctIndex: 0 },
  { id: "A04", track: "both", topic: "adjectives", difficulty: 3, thai: "ถูกกว่า", translit: "thùuk gwàa", choices: ["Cheaper", "More expensive", "Heavier", "Closer"], correctIndex: 0 },
  { id: "A05", track: "both", topic: "adjectives", difficulty: 3, thai: "ใกล้นิดเดียว", translit: "glâi nít-diao", choices: ["Very close", "Very far", "Very easy", "Very noisy"], correctIndex: 0 },
  { id: "A06", track: "both", topic: "adjectives", difficulty: 3, thai: "ไกลมาก", translit: "glai mâak", choices: ["Very far", "Very close", "Very old", "Very new"], correctIndex: 0 },
  { id: "A07", track: "both", topic: "adjectives", difficulty: 4, thai: "อากาศร้อน", translit: "aa-gàat róon", choices: ["The weather is hot", "The weather is cold", "The weather is windy", "The weather is cloudy"], correctIndex: 0 },
  { id: "A08", track: "both", topic: "adjectives", difficulty: 4, thai: "อากาศเย็น", translit: "aa-gàat yen", choices: ["The weather is cool", "The weather is hot", "The weather is humid", "The weather is dry"], correctIndex: 0 },
  { id: "A09", track: "both", topic: "adjectives", difficulty: 4, thai: "หวานไป", translit: "wǎan bpai", choices: ["Too sweet", "Too salty", "Too spicy", "Too sour"], correctIndex: 0 },
  { id: "A10", track: "both", topic: "adjectives", difficulty: 4, thai: "เค็มไปนิด", translit: "khem bpai nít", choices: ["A bit too salty", "A bit too sweet", "A bit too bitter", "A bit too spicy"], correctIndex: 0 },

  // B1 difficulty 4 — complex grammar, multi-clause, abstract verbs
  { id: "H01", track: "both", topic: "grammar", difficulty: 4, thai: "ถ้าฝนตกก็จะอยู่บ้าน", translit: "thâa fǒn dtòk gâw jà yùu bâan", choices: ["If it rains, I'll stay home", "When it rains, I go outside", "It rained so I left home", "It will rain at home"], correctIndex: 0 },
  { id: "H02", track: "both", topic: "grammar", difficulty: 4, thai: "เขาบอกว่าจะมาสาย", translit: "khǎo bàawk wâa jà maa sǎai", choices: ["He said he'd be late", "He told me to leave", "He asked me to wait", "He thinks it's early"], correctIndex: 0 },
  { id: "H03", track: "both", topic: "verbs", difficulty: 4, thai: "ฉันเห็นด้วยกับคุณ", translit: "chǎn hěn-dûuay gàp khun", choices: ["I agree with you", "I see you clearly", "I look at you", "I stand with you"], correctIndex: 0 },
  { id: "H04", track: "both", topic: "verbs", difficulty: 4, thai: "ขึ้นอยู่กับสถานการณ์", translit: "khʉ̂n yùu gàp sà-thǎa-ná-gaan", choices: ["It depends on the situation", "It's above the situation", "It's because of the situation", "It controls the situation"], correctIndex: 0 },
  { id: "H05", track: "both", topic: "grammar", difficulty: 4, thai: "เขาเก่งกว่าฉันเยอะ", translit: "khǎo gèng gwàa chǎn yə́", choices: ["He's much better than me", "He's as good as me", "He's not as good as me", "He's the best of all"], correctIndex: 0 },
  { id: "H06", track: "both", topic: "particles", difficulty: 4, thai: "ไปกันเถอะ", translit: "bpai gan thə̀", choices: ["Let's go!", "Don't go!", "Go away!", "Go already!"], correctIndex: 0 },
  { id: "H07", track: "both", topic: "daily_life", difficulty: 4, thai: "ฉันเคยทำงานที่นี่สองปี", translit: "chǎn kəəy tam-ngaan thîi-nîi sǎawng bpii", choices: ["I used to work here for two years", "I've been working here two years", "I will work here two years", "I started working here two years ago"], correctIndex: 0 },
  { id: "H08", track: "both", topic: "grammar", difficulty: 4, thai: "ยิ่งเรียนยิ่งเก่ง", translit: "yîng riian yîng gèng", choices: ["The more you study, the better you get", "Study hard to be smart", "Studying is very important", "You must study more"], correctIndex: 0 },
  { id: "H09", track: "both", topic: "verbs", difficulty: 4, thai: "ฉันยังตัดสินใจไม่ได้", translit: "chǎn yang dtàt-sǐn-jai mâi dâai", choices: ["I still can't decide", "I already decided", "I don't want to decide", "I decided quickly"], correctIndex: 0 },
  { id: "H10", track: "both", topic: "daily_life", difficulty: 4, thai: "เขาทำเป็นไม่รู้เรื่อง", translit: "khǎo tam bpen mâi rúu rʉ̂ang", choices: ["He pretended not to know", "He didn't know anything", "He made a mistake", "He forgot everything"], correctIndex: 0 },

  // B1-B2 difficulty 5 — idioms, formal register, passive, disambiguation
  { id: "H11", track: "both", topic: "grammar", difficulty: 5, thai: "เขาถูกไล่ออกจากงาน", translit: "khǎo thùuk lâi àawk jàak ngaan", choices: ["He was fired from work", "He quit his job", "He left work early", "He was promoted at work"], correctIndex: 0 },
  { id: "H12", track: "both", topic: "grammar", difficulty: 5, thai: "แม่ให้ฉันไปซื้อของ", translit: "mâae hâi chǎn bpai sʉ́ʉ khǎawng", choices: ["Mom had me go shopping", "Mom went shopping with me", "Mom likes to go shopping", "Mom bought things for me"], correctIndex: 0 },
  { id: "H13", track: "both", topic: "adjectives", difficulty: 5, thai: "เขาเป็นคนปากหวาน", translit: "khǎo bpen khon bpàak-wǎan", choices: ["He's a smooth talker", "He likes sweet food", "He has a nice smile", "He speaks quietly"], correctIndex: 0 },
  { id: "H14", track: "both", topic: "adjectives", difficulty: 5, thai: "ใจเย็นๆนะ", translit: "jai-yen-yen ná", choices: ["Calm down / Be patient", "Feel free to relax", "Stay cool in the heat", "Don't be cold-hearted"], correctIndex: 0 },
  { id: "H15", track: "both", topic: "adjectives", difficulty: 5, thai: "เขาเป็นคนหน้าบาง", translit: "khǎo bpen khon nâa-baang", choices: ["He's easily embarrassed", "He has a thin face", "He's very shy around people", "He doesn't show emotion"], correctIndex: 0 },
  { id: "H16", track: "both", topic: "politeness", difficulty: 5, thai: "กรุณารอสักครู่", translit: "gà-rú-naa raaw sàk khrûu", choices: ["Please wait a moment (formal)", "Please come quickly", "Please sit down here", "Please speak louder"], correctIndex: 0 },
  { id: "H17", track: "both", topic: "grammar", difficulty: 5, thai: "คนที่ฉันคุยด้วยเมื่อวานเป็นหมอ", translit: "khon thîi chǎn khui dûay mûuea-waan bpen mǎaw", choices: ["The person I spoke with yesterday is a doctor", "The doctor I visited yesterday was kind", "Yesterday I talked about becoming a doctor", "The doctor told me something yesterday"], correctIndex: 0 },
  { id: "H18", track: "both", topic: "daily_life", difficulty: 5, thai: "เขาพูดอ้อมค้อมไม่ยอมตอบตรงๆ", translit: "khǎo phûut âawm-khâawm mâi yaawm dtàawp dtrong-dtrong", choices: ["He spoke indirectly and wouldn't answer straight", "He spoke loudly and answered everything", "He spoke softly and gave a clear answer", "He refused to speak and stayed silent"], correctIndex: 0 },
  { id: "H19", track: "both", topic: "particles", difficulty: 5, thai: "ทำไมไม่บอกล่ะ", translit: "tam-mai mâi bàawk lâ", choices: ["Why didn't you say so? (pressing)", "Why don't you know?", "Why can't you hear?", "Why won't you listen?"], correctIndex: 0 },
  { id: "H20", track: "both", topic: "grammar", difficulty: 5, thai: "ถ้าฉันรู้ก่อนก็คงไม่ไป", translit: "thâa chǎn rúu gàawn gâw khong mâi bpai", choices: ["If I'd known earlier, I probably wouldn't have gone", "If I go first, I'll know the way", "I didn't know so I went anyway", "I knew but I still went"], correctIndex: 0 },
];

function toPlacementQuestion(seed: PlacementSeed): AssessmentQuestion {
  const { rotated, rotatedCorrectIndex } = rotateChoiceStrings(
    seed.id,
    seed.choices,
    seed.correctIndex
  );

  const choices = rotated.map((english, index) => ({
    id: createChoiceId(seed.id, index),
    english,
  }));

  return {
    id: seed.id,
    quizKind: "placement",
    track: seed.track,
    topic: seed.topic,
    difficulty: seed.difficulty,
    prompt: "What does this Thai phrase mean in English?",
    thai: seed.thai,
    translit: seed.translit,
    choices,
    correctChoiceId: createChoiceId(seed.id, rotatedCorrectIndex),
    audioSrc: `/audio/quizzes/placement/${seed.id}.mp3`,
  };
}

export const placementQuestionBank = placementSeed.map(toPlacementQuestion);

interface ToneSeed {
  id: string;
  topic: "tones";
  difficulty: Difficulty;
  thai: string;
  translit: string;
  correctIndex: 0 | 1 | 2 | 3;
  options: AudioChoiceSeed[];
}

const toneSeed = [
  {
    id: "TONE01",
    topic: "tones" as const,
    difficulty: 3 as Difficulty,
    thai: "ไม่",
    translit: "mâi",
    correctIndex: 0 as const,
    options: [
      { thai: "ไม่", translit: "mâi", english: "no" },
      { thai: "ใหม่", translit: "mài", english: "new" },
      { thai: "ไหม", translit: "mǎi", english: "question/silk" },
      { thai: "ไม้", translit: "máai", english: "wood" },
    ],
  },
  {
    id: "TONE02",
    topic: "tones" as const,
    difficulty: 3 as Difficulty,
    thai: "ใหม่",
    translit: "mài",
    correctIndex: 0 as const,
    options: [
      { thai: "ใหม่", translit: "mài", english: "new" },
      { thai: "ไม่", translit: "mâi", english: "no" },
      { thai: "ไหม", translit: "mǎi", english: "question/silk" },
      { thai: "ไม้", translit: "máai", english: "wood" },
    ],
  },
  {
    id: "TONE03",
    topic: "tones" as const,
    difficulty: 3 as Difficulty,
    thai: "ไหม",
    translit: "mǎi",
    correctIndex: 0 as const,
    options: [
      { thai: "ไหม", translit: "mǎi", english: "question/silk" },
      { thai: "ไม่", translit: "mâi", english: "no" },
      { thai: "ใหม่", translit: "mài", english: "new" },
      { thai: "ไม้", translit: "máai", english: "wood" },
    ],
  },
  {
    id: "TONE04",
    topic: "tones" as const,
    difficulty: 3 as Difficulty,
    thai: "ไม้",
    translit: "máai",
    correctIndex: 0 as const,
    options: [
      { thai: "ไม้", translit: "máai", english: "wood" },
      { thai: "ไม่", translit: "mâi", english: "no" },
      { thai: "ใหม่", translit: "mài", english: "new" },
      { thai: "ไหม", translit: "mǎi", english: "question/silk" },
    ],
  },
  {
    id: "TONE05",
    topic: "tones" as const,
    difficulty: 4 as Difficulty,
    thai: "เข้า",
    translit: "khâo",
    correctIndex: 0 as const,
    options: [
      { thai: "เข้า", translit: "khâo", english: "enter" },
      { thai: "เขา", translit: "khǎo", english: "he/mountain" },
      { thai: "ข้าว", translit: "khâao", english: "rice" },
      { thai: "ข่าว", translit: "khàao", english: "news" },
    ],
  },
  {
    id: "TONE06",
    topic: "tones" as const,
    difficulty: 4 as Difficulty,
    thai: "เขา",
    translit: "khǎo",
    correctIndex: 0 as const,
    options: [
      { thai: "เขา", translit: "khǎo", english: "he/mountain" },
      { thai: "เข้า", translit: "khâo", english: "enter" },
      { thai: "ข้าว", translit: "khâao", english: "rice" },
      { thai: "ข่าว", translit: "khàao", english: "news" },
    ],
  },
  {
    id: "TONE07",
    topic: "tones" as const,
    difficulty: 4 as Difficulty,
    thai: "ข้าว",
    translit: "khâao",
    correctIndex: 0 as const,
    options: [
      { thai: "ข้าว", translit: "khâao", english: "rice" },
      { thai: "ข่าว", translit: "khàao", english: "news" },
      { thai: "เขา", translit: "khǎo", english: "he/mountain" },
      { thai: "เข้า", translit: "khâo", english: "enter" },
    ],
  },
  {
    id: "TONE08",
    topic: "tones" as const,
    difficulty: 4 as Difficulty,
    thai: "ข่าว",
    translit: "khàao",
    correctIndex: 0 as const,
    options: [
      { thai: "ข่าว", translit: "khàao", english: "news" },
      { thai: "ข้าว", translit: "khâao", english: "rice" },
      { thai: "เขา", translit: "khǎo", english: "he/mountain" },
      { thai: "เข้า", translit: "khâo", english: "enter" },
    ],
  },
] satisfies ToneSeed[];

export const toneRecognitionQuestionBank: AssessmentQuestion[] = toneSeed.map(
  (seed) => {
    const { rotated, rotatedCorrectIndex } = rotateAudioChoices(
      seed.id,
      seed.options,
      seed.correctIndex
    );

    const choices = rotated.map((option, index) => ({
      id: createChoiceId(seed.id, index),
      thai: option.thai,
      translit: option.translit,
      english: option.english,
    }));

    return {
      id: seed.id,
      quizKind: "tones",
      track: "both",
      topic: seed.topic,
      difficulty: seed.difficulty,
      prompt: "Which word did you hear?",
      thai: seed.thai,
      translit: seed.translit,
      choices,
      correctChoiceId: createChoiceId(seed.id, rotatedCorrectIndex),
      audioSrc: `/audio/quizzes/tones/${seed.id}.mp3`,
    };
  }
);

const readerWordLookup: Record<string, { translit: string; english: string }> = {
  "ใหม่": { translit: "mài", english: "new" },
  "ไม่": { translit: "mâi", english: "no/not" },
  "ไหม": { translit: "mǎi", english: "question particle/silk" },
  "ไม้": { translit: "máai", english: "wood" },
  "เข้า": { translit: "khâo", english: "enter" },
  "เขา": { translit: "khǎo", english: "he/mountain" },
  "ข่าว": { translit: "khàao", english: "news" },
  "ข้าว": { translit: "khâao", english: "rice" },
  "ใกล้": { translit: "glâi", english: "near" },
  "ไกล": { translit: "glāi", english: "far" },
  "กลาย": { translit: "glāai", english: "become" },
  "ใคร": { translit: "khrāi", english: "who" },
  "ป่า": { translit: "bpàa", english: "forest" },
  "ป้า": { translit: "bpâa", english: "aunt" },
  "ปา": { translit: "bpaa", english: "throw" },
  "ปลา": { translit: "bplaa", english: "fish" },
  "เสือ": { translit: "sʉ̌a", english: "tiger" },
  "เสื้อ": { translit: "sʉ̂a", english: "shirt" },
  "ชื่อ": { translit: "chʉ̂ʉ", english: "name" },
  "เชื่อ": { translit: "chʉ̂a", english: "believe" },
  "ค่า": { translit: "khâa", english: "cost/value" },
  "ขา": { translit: "khǎa", english: "leg" },
  "ค้า": { translit: "kháa", english: "trade" },
  "คา": { translit: "khaa", english: "stuck/remaining" },
};

interface ReaderSeed {
  id: string;
  thai: string;
  translit: string;
  difficulty: Difficulty;
  options: string[];
  correctIndex: 0 | 1 | 2 | 3;
}

const readerSeed = [
  { id: "RT01", thai: "ใหม่", translit: "mài", difficulty: 4 as Difficulty, options: ["ใหม่", "ไม่", "ไหม", "ไม้"], correctIndex: 0 as const },
  { id: "RT02", thai: "ไม่", translit: "mâi", difficulty: 4 as Difficulty, options: ["ไม่", "ใหม่", "ไหม", "ไม้"], correctIndex: 0 as const },
  { id: "RT03", thai: "ไหม", translit: "mǎi", difficulty: 4 as Difficulty, options: ["ไหม", "ไม่", "ใหม่", "ไม้"], correctIndex: 0 as const },
  { id: "RT04", thai: "ไม้", translit: "máai", difficulty: 4 as Difficulty, options: ["ไม้", "ไม่", "ใหม่", "ไหม"], correctIndex: 0 as const },
  { id: "RT05", thai: "เข้า", translit: "khâo", difficulty: 4 as Difficulty, options: ["เข้า", "เขา", "ข่าว", "ข้าว"], correctIndex: 0 as const },
  { id: "RT06", thai: "เขา", translit: "khǎo", difficulty: 4 as Difficulty, options: ["เขา", "เข้า", "ข่าว", "ข้าว"], correctIndex: 0 as const },
  { id: "RT07", thai: "ข่าว", translit: "khàao", difficulty: 5 as Difficulty, options: ["ข่าว", "ข้าว", "เขา", "เข้า"], correctIndex: 0 as const },
  { id: "RT08", thai: "ข้าว", translit: "khâao", difficulty: 5 as Difficulty, options: ["ข้าว", "ข่าว", "เขา", "เข้า"], correctIndex: 0 as const },
  { id: "RT09", thai: "ใกล้", translit: "glâi", difficulty: 5 as Difficulty, options: ["ใกล้", "ไกล", "กลาย", "ใคร"], correctIndex: 0 as const },
  { id: "RT10", thai: "ไกล", translit: "glāi", difficulty: 5 as Difficulty, options: ["ไกล", "ใกล้", "กลาย", "ใคร"], correctIndex: 0 as const },
  { id: "RT11", thai: "ป่า", translit: "bpàa", difficulty: 5 as Difficulty, options: ["ป่า", "ป้า", "ปา", "ปลา"], correctIndex: 0 as const },
  { id: "RT12", thai: "เสื้อ", translit: "sʉ̂a", difficulty: 5 as Difficulty, options: ["เสื้อ", "เสือ", "ชื่อ", "เชื่อ"], correctIndex: 0 as const },
  { id: "RT13", thai: "ค่า", translit: "khâa", difficulty: 5 as Difficulty, options: ["ค่า", "ขา", "ค้า", "คา"], correctIndex: 0 as const },
] satisfies ReaderSeed[];

export const readerToneQuestionBank: AssessmentQuestion[] = readerSeed.map(
  (seed) => {
    const { rotated, rotatedCorrectIndex } = rotateChoiceStrings(
      seed.id,
      seed.options,
      seed.correctIndex
    );

    const choices = rotated.map((thai, index) => ({
      id: createChoiceId(seed.id, index),
      thai,
      translit: readerWordLookup[thai]?.translit,
      english: readerWordLookup[thai]?.english,
    }));

    return {
      id: seed.id,
      quizKind: "reader_tones",
      track: "reader",
      topic: "reader_tones",
      difficulty: seed.difficulty,
      prompt: "Listen only. Which Thai word did you hear?",
      thai: seed.thai,
      translit: seed.translit,
      choices,
      correctChoiceId: createChoiceId(seed.id, rotatedCorrectIndex),
      audioSrc: `/audio/quizzes/reader-tones/${seed.id}.mp3`,
    };
  }
);

export const topicLabelMap: Record<AssessmentTopic, string> = {
  greetings: "Greetings",
  politeness: "Politeness",
  self_intro: "Self-introduction",
  basics: "Core basics",
  numbers: "Numbers",
  shopping: "Shopping",
  time: "Time",
  days: "Days",
  scheduling: "Scheduling",
  directions: "Directions",
  transport: "Transport",
  food: "Food",
  ordering: "Ordering",
  question_words: "Question words",
  particles: "Particles",
  grammar: "Grammar",
  verbs: "Basic verbs",
  adjectives: "Adjectives",
  family: "Family",
  daily_life: "Daily life",
  tones: "Tone recognition",
  reader_tones: "Reader tone/script discrimination",
};

const allQuestionsByKind: Record<AssessmentQuizKind, AssessmentQuestion[]> = {
  placement: placementQuestionBank,
  tones: toneRecognitionQuestionBank,
  reader_tones: readerToneQuestionBank,
};

const questionLookupByKind: Record<AssessmentQuizKind, Record<string, AssessmentQuestion>> = {
  placement: Object.fromEntries(placementQuestionBank.map((question) => [question.id, question])),
  tones: Object.fromEntries(toneRecognitionQuestionBank.map((question) => [question.id, question])),
  reader_tones: Object.fromEntries(readerToneQuestionBank.map((question) => [question.id, question])),
};

export function getQuestionById(quizKind: AssessmentQuizKind, questionId: string) {
  return questionLookupByKind[quizKind][questionId];
}

export function getQuestionsByIds(
  quizKind: AssessmentQuizKind,
  questionIds: string[]
): AssessmentQuestion[] {
  return questionIds
    .map((questionId) => getQuestionById(quizKind, questionId))
    .filter((question): question is AssessmentQuestion => Boolean(question));
}

export function getQuestionBank(quizKind: AssessmentQuizKind): AssessmentQuestion[] {
  return allQuestionsByKind[quizKind];
}

validateQuestionBankTransliteration("placement", placementQuestionBank);
validateQuestionBankTransliteration("tones", toneRecognitionQuestionBank);
validateQuestionBankTransliteration("reader_tones", readerToneQuestionBank);
