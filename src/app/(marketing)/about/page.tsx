export default function AboutPage() {
  return (
    <div className="py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">🇹🇭</div>
          <h1 className="text-4xl font-bold text-foreground">About Nine</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            The person behind Immersion Thai
          </p>
        </div>

        <div className="prose prose-lg max-w-none text-foreground">
          <div className="space-y-6 text-muted-foreground">
            <p>
              สวัสดีค่ะ! Hi, I&apos;m Nine — a native Thai speaker passionate about
              helping people learn Thai in a fun, natural way.
            </p>
            <p>
              I started sharing Thai lessons on TikTok and Instagram, and the
              response was amazing. So many people wanted to learn Thai but found
              traditional methods boring or confusing. That&apos;s why I created this
              course — to make learning Thai feel natural and enjoyable.
            </p>
            <p>
              My teaching approach focuses on practical, everyday Thai that you
              can use right away. Each lesson includes video explanations, full
              scripts in Thai and English, flashcards for vocabulary practice,
              and quizzes to test your understanding.
            </p>
            <p>
              Whether you&apos;re planning a trip to Thailand, connecting with Thai
              family, or just love the language — I&apos;m here to help you on your
              journey.
            </p>

            <div className="flex gap-4 pt-4">
              <a
                href="https://tiktok.com/@thaiwith.nine"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                TikTok
              </a>
              <a
                href="https://instagram.com/thaiwith.nine"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Instagram
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
