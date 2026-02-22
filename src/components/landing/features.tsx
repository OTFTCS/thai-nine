const features = [
  {
    icon: "🎬",
    title: "Video Lessons",
    description:
      "Watch Nine teach Thai naturally with full Thai and English scripts included with every lesson.",
  },
  {
    icon: "🗂️",
    title: "Smart Flashcards",
    description:
      "Anki-style spaced repetition flashcards that adapt to how well you remember each word.",
  },
  {
    icon: "✅",
    title: "Lesson Quizzes",
    description:
      "Test your understanding after each lesson with interactive quizzes and instant feedback.",
  },
  {
    icon: "📄",
    title: "PDF Downloads",
    description:
      "Download study guides and vocabulary sheets to review offline, anytime.",
  },
];

export function Features() {
  return (
    <section className="py-20 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground">
            Everything you need to learn Thai
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            A complete learning system designed for real progress
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="text-center p-6 rounded-xl bg-card border border-border hover:shadow-md transition-shadow"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
