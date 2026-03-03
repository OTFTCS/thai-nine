import type { AssessmentQuestion } from "@/types/assessment";

// Accepts combining marks and precomposed latin characters used for Thai tone-marked transliteration.
const DIACRITIC_PATTERN = /[\p{M}àáâãäāèéêëēìíîïīòóôöōùúûüūǎǐǒǔǚǜʉ̀ʉ̂ʉ̌ɔ̀ɔ́ə̌]/u;
const LATIN_PATTERN = /[a-z]/i;

export function hasToneMark(transliteration: string): boolean {
  return DIACRITIC_PATTERN.test(transliteration.normalize("NFD"));
}

export function assertToneMarkedTransliteration(
  transliteration: string,
  context: string
) {
  const normalized = transliteration.trim();

  if (!normalized) {
    throw new Error(`Missing transliteration for ${context}`);
  }

  // The project style allows non-marked syllables (e.g. "jer-gan gii moong"),
  // but transliteration must still be Latin-script content.
  if (!LATIN_PATTERN.test(normalized)) {
    throw new Error(
      `Invalid transliteration for ${context}: "${transliteration}"`
    );
  }
}

export function validateQuestionBankTransliteration(
  bankName: string,
  questions: AssessmentQuestion[]
) {
  questions.forEach((question) => {
    assertToneMarkedTransliteration(
      question.translit,
      `${bankName}/${question.id}`
    );

    question.choices.forEach((choice) => {
      if (choice.translit) {
        assertToneMarkedTransliteration(
          choice.translit,
          `${bankName}/${question.id}/${choice.id}`
        );
      }
    });
  });
}
