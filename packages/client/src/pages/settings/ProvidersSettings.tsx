import { Card, CardBody } from "@/components/ui/Card";
import { SettingsHeading } from "../SettingsPage";

/** Placeholder until the provider layer lands (build step 2). */
export function ProvidersSettings() {
  return (
    <>
      <SettingsHeading>Providers</SettingsHeading>
      <Card>
        <CardBody>
          <p className="text-[13px] text-muted">Provider management arrives with the next build step.</p>
        </CardBody>
      </Card>
    </>
  );
}
