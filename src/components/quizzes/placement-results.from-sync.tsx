import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AssessmentQuestion,
  AssessmentScoreSummary,
  PlacementRecommendation,
} from "@/types/assessment";
import { topicLabelMap } from "@/lib/quiz/question-banks";
import { shouldShowToneQuizCta } from "@/lib/quiz/scoring";

interface PlacementResultsProps {
  summary: AssessmentScoreSummary;
  recommendation: PlacementRecommendation;
  missedQuestions: AssessmentQuestion[];
  showLearnerTranslit: boolean;
}

function toConfidenceLabel(confidence: PlacementRecommendation["confidence"]) {
  if (confidence === "high") {
    return "High";
  }
  if (confidence === "medium") {
    return "Medium";
  }
  return "Low";
}

export function PlacementResults({
  summary,
  recommendation,
  missedQuestions,
  showLearnerTranslit,
}: PlacementResultsProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Placement Result</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Weighted score: <span className="font-semibold text-foreground">{summary.score}%</span>
            {" "}({summary.answeredCount}/{summary.totalCount} answered)
          </p>
          <p className="text-sm text-muted-foreground">
            Placement band: <span className="font-semibold text-foreground">{recommendation.band}</span>
            {" "}| Confidence: <span className="font-semibold text-foreground">{toConfidenceLabel(recommendation.confidence)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            You chose &quot;I don&apos;t know&quot;{" "}
            <span className="font-semibold text-foreground">{summary.totalIdk}</span>{" "}
            {summary.totalIdk === 1 ? "time" : "times"}.
          </p>
          {summary.completionPercent < 100 && (
            <p className="text-xs text-accent">
              Advisory result: this attempt was partial ({summary.completionPercent}% completion).
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Strengths + Gaps</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Top strengths</h3>
            <ul className="space-y-2">
              {recommendation.strengths.length === 0 && (
                <li className="text-sm text-muted-foreground">Not enough data yet.</li>
              )}
              {recommendation.strengths.map((item) => (
                <li key={item.topic} className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">{topicLabelMap[item.topic]}</span>
                  {" "}- {item.score}%
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Biggest gaps</h3>
            <ul className="space-y-2">
              {recommendation.gaps.length === 0 && (
                <li className="text-sm text-muted-foreground">Not enough data yet.</li>
              )}
              {recommendation.gaps.map((item) => (
                <li key={item.topic} className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">{topicLabelMap[item.topic]}</span>
                  {" "}- {item.score}% ({item.idk} idk, {item.wrong} wrong)
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recommended Starting Point</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Start at <span className="font-semibold text-foreground">{recommendation.moduleId}</span>
            {" "}- {recommendation.moduleTitle}
          </p>
          <div className="space-y-2">
            {recommendation.lessonLinks.map((lessonLink) =>
              lessonLink.href ? (
                <Link
                  key={lessonLink.title}
                  href={lessonLink.href}
                  className="block text-sm text-primary hover:text-primary-dark"
                >
                  {lessonLink.title}
                </Link>
              ) : (
                <p key={lessonLink.title} className="text-sm text-muted-foreground">
                  {lessonLink.title}
                </p>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {shouldShowToneQuizCta(summary) && (
        <Card>
          <CardContent className="py-6 space-y-4">
            <p className="text-sm text-foreground">
              Because you’ve got over 70% correct, you should now take this short tone recognition quiz
            </p>
            <Link href="/quiz/tones">
              <Button>Take Tone Recognition Quiz</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Missed Items</CardTitle>
        </CardHeader>
        <CardContent>
          {missedQuestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No misses in answered items.</p>
          ) : (
            <ul className="space-y-3">
              {missedQuestions.map((question) => (
                <li key={question.id} className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{question.id}</span>
                  {" "}- {question.thai}
                  {showLearnerTranslit ? ` (${question.translit})` : ""}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link href="/quiz">
          <Button variant="outline">Retake Placement Quiz</Button>
        </Link>
        <Link href="/admin/quizzes">
          <Button variant="ghost">Open Nine Mode</Button>
        </Link>
      </div>
    </div>
  );
}
