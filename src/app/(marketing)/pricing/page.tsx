import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const tiers = [
  {
    name: "Monthly",
    price: "$19.99",
    period: "/month",
    description: "Full access, pay as you go",
    features: [
      "All video lessons",
      "Full transcripts (Thai + English)",
      "PDF study guides",
      "All flashcard decks",
      "All quizzes with explanations",
      "Progress tracking",
      "New lessons added regularly",
    ],
    notIncluded: [],
    cta: "Get Started",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Yearly",
    price: "$149",
    period: "/year",
    description: "Save over 35% — best value",
    features: [
      "All video lessons",
      "Full transcripts (Thai + English)",
      "PDF study guides",
      "All flashcard decks",
      "All quizzes with explanations",
      "Progress tracking",
      "New lessons added regularly",
      "Priority support",
    ],
    notIncluded: [],
    cta: "Get Yearly Access",
    href: "/signup",
    highlighted: true,
  },
  {
    name: "Lifetime",
    price: "$199",
    period: "one-time",
    description: "Pay once, learn forever",
    features: [
      "All video lessons",
      "Full transcripts (Thai + English)",
      "PDF study guides",
      "All flashcard decks",
      "All quizzes with explanations",
      "Progress tracking",
      "New lessons added regularly",
      "Priority support",
      "Lifetime updates",
    ],
    notIncluded: [],
    cta: "Get Lifetime Access",
    href: "/signup",
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div className="py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground">
            Simple, transparent pricing
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Choose the plan that works for you
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={
                tier.highlighted
                  ? "border-primary shadow-lg ring-2 ring-primary/20"
                  : ""
              }
            >
              <CardHeader>
                {tier.highlighted && (
                  <span className="inline-block text-xs font-semibold text-primary bg-primary/10 rounded-full px-3 py-1 mb-3 w-fit">
                    Best Value
                  </span>
                )}
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {tier.description}
                </p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">
                    {tier.price}
                  </span>
                  <span className="text-muted-foreground ml-1">
                    {tier.period}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <span className="text-success mt-0.5">&#10003;</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                  {tier.notIncluded.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <span className="mt-0.5">&#10007;</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href={tier.href}>
                  <Button
                    variant={tier.highlighted ? "primary" : "outline"}
                    className="w-full"
                  >
                    {tier.cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
