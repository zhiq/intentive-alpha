import { Card, CardContent } from "@/components/ui/primitives";
import { IntentBox } from "@/components/intent/IntentBox";

const EXAMPLES = [
  "2pm today free Thai massage 2 hours near me",
  "relaxing massage after work near KLCC under RM250",
  "tmr morning 2 hour deep tissue near me",
  "same as last time but this Friday",
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="space-y-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Tell us what you need.
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          We&apos;ll turn it into a live request and bring back a few reasoned
          offers. No browsing. No searching. Just say it.
        </p>
      </section>

      <Card>
        <CardContent className="pt-5">
          <IntentBox examples={EXAMPLES} />
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          {
            title: "Messy intent in",
            body: "Type it like you'd say it. We parse it into a clear Intent Card you can see and edit.",
          },
          {
            title: "Live market activated",
            body: "We invite only the best-matched providers — never spam every shop.",
          },
          {
            title: "Reasoned offers out",
            body: "A few ranked offers with a plain-language brief, not a long list.",
          },
        ].map((s) => (
          <Card key={s.title}>
            <CardContent className="space-y-1 pt-5">
              <p className="font-semibold">{s.title}</p>
              <p className="text-sm text-muted-foreground">{s.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
