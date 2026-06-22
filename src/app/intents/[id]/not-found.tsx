import Link from "next/link";
import { Button, Card, CardContent } from "@/components/ui/primitives";

export default function IntentNotFound() {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6 text-center">
        <h1 className="text-xl font-semibold">Request not found</h1>
        <p className="text-sm text-muted-foreground">
          This request doesn&apos;t exist, or it isn&apos;t yours to view.
        </p>
        <Link href="/" className="inline-block">
          <Button variant="outline">Start a new request</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
