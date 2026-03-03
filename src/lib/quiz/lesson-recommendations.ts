import type {
  LessonRecommendationLink,
  PlacementBand,
} from "@/types/assessment";

interface ModuleRecommendation {
  moduleNumber: number;
  moduleTitle: string;
  lessonLinks: LessonRecommendationLink[];
}

const moduleRecommendations: Record<number, ModuleRecommendation> = {
  0: {
    moduleNumber: 0,
    moduleTitle: "Onboarding + Pronunciation Prep",
    lessonLinks: [
      {
        title: "Lesson 1: Thai Greetings & Introductions",
        href: "/lessons/lesson-1",
      },
      {
        title: "Lesson 2: Numbers & Counting",
        href: "/lessons/lesson-2",
      },
      {
        title: "Lesson 3 mapping pending in app route config",
        placeholder: true,
      },
    ],
  },
  1: {
    moduleNumber: 1,
    moduleTitle: "Thai Script Fundamentals",
    lessonLinks: [
      {
        title: "Lesson 6: Thai Tones & Pronunciation",
        href: "/lessons/lesson-6",
      },
      {
        title: "Lesson 4: Getting Around & Directions",
        href: "/lessons/lesson-4",
      },
      {
        title: "Lesson 5: Shopping & Bargaining",
        href: "/lessons/lesson-5",
      },
    ],
  },
  2: {
    moduleNumber: 2,
    moduleTitle: "Survival Thai",
    lessonLinks: [
      {
        title: "Lesson 1: Thai Greetings & Introductions",
        href: "/lessons/lesson-1",
      },
      {
        title: "Lesson 3: At the Restaurant",
        href: "/lessons/lesson-3",
      },
      {
        title: "Lesson 4: Getting Around & Directions",
        href: "/lessons/lesson-4",
      },
    ],
  },
  3: {
    moduleNumber: 3,
    moduleTitle: "Sentence Building Essentials",
    lessonLinks: [
      {
        title: "Lesson 5: Shopping & Bargaining",
        href: "/lessons/lesson-5",
      },
      {
        title: "Lesson 6: Thai Tones & Pronunciation",
        href: "/lessons/lesson-6",
      },
      {
        title: "Module 3 lesson slugs 17-20 placeholder (pending)",
        placeholder: true,
      },
    ],
  },
  4: {
    moduleNumber: 4,
    moduleTitle: "High-Frequency Vocabulary Systems",
    lessonLinks: [
      {
        title: "Lesson 3: At the Restaurant",
        href: "/lessons/lesson-3",
      },
      {
        title: "Lesson 5: Shopping & Bargaining",
        href: "/lessons/lesson-5",
      },
      {
        title: "Module 4 mapping placeholder (future lesson slugs)",
        placeholder: true,
      },
    ],
  },
  5: {
    moduleNumber: 5,
    moduleTitle: "Listening + Speaking Patterns",
    lessonLinks: [
      {
        title: "Lesson 6: Thai Tones & Pronunciation",
        href: "/lessons/lesson-6",
      },
      {
        title: "Module 5 mapping placeholder (future lesson slugs)",
        placeholder: true,
      },
      {
        title: "Module 6+ progression placeholder",
        placeholder: true,
      },
    ],
  },
};

const bandToModule: Record<PlacementBand, number> = {
  "A1.0": 0,
  "A1.1": 1,
  "A1.2": 2,
  "A2.0": 3,
  "A2.1": 4,
  "B1-ish": 5,
};

export function getRecommendationForBand(band: PlacementBand): ModuleRecommendation {
  return moduleRecommendations[bandToModule[band]];
}
