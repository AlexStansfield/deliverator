import { Card, CardBody } from "@/components/ui/Card";
import { SettingsHeading } from "../SettingsPage";
import { serverVersion, basePath } from "@/lib/env";

export function AboutSettings() {
  return (
    <>
      <SettingsHeading>About</SettingsHeading>
      <Card>
        <CardBody className="text-[13px] text-muted">
          <p>
            <b className="text-fg">Deliverator {serverVersion}</b> · MIT licensed · built with AI coding.
          </p>
          <p>
            A single, simple view of your download clients. It covers the things you do often (add, pause, delete, throttle) and leaves the rest to
            each client's own interface.
          </p>
          <p>
            Suggestions and pull requests are welcome on{" "}
            <a className="text-accent underline-offset-2 hover:underline" href="https://github.com/AlexStansfield/deliverator" target="_blank" rel="noreferrer">
              GitHub
            </a>
            .
          </p>
          <p className="font-mono text-[12px] text-faint">base path: {basePath || "/"}</p>
        </CardBody>
      </Card>
    </>
  );
}
