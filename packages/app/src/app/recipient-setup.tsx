"use client";

import { ArrowRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useSharingSession } from "@/contex/sharing-session";

export function RecipientSetup() {
  const router = useRouter();
  const { recipientEmail, setRecipientEmail } = useSharingSession();
  const [email, setEmail] = useState(recipientEmail ?? "");
  const [error, setError] = useState<string | null>(null);

  function continueToWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("recipientEmail");
    if (!(input instanceof HTMLInputElement)) return;

    const trimmedEmail = email.trim();
    // Validate the trimmed value with the browser's email rules.
    input.value = trimmedEmail;
    setEmail(trimmedEmail);

    if (!input.validity.valid) {
      setError(
        trimmedEmail
          ? "Enter a valid email address, like alex@example.com."
          : "Enter the recipient’s email to continue.",
      );
      input.focus();
      return;
    }

    setRecipientEmail(trimmedEmail);
    router.push("/share");
  }

  function skipRecipient() {
    setRecipientEmail(null);
    router.push("/share");
  }

  return (
    <main
      aria-label="Set up sharing"
      className="flex min-h-[calc(100svh-56px)] flex-col px-[22px] min-[540px]:px-8"
    >
      <div className="mx-auto my-auto w-full max-w-[440px] py-12 min-[540px]:py-16">
        <div className="animate-in fade-in-0 slide-in-from-bottom-1.5 animation-duration-500 ease-out fill-mode-both motion-reduce:animate-none">
          <form onSubmit={continueToWorkspace} noValidate>
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <FieldLabel htmlFor="recipient-email">
                    Recipient email
                  </FieldLabel>
                  <Badge variant="secondary">Recommended</Badge>
                </div>
                <Input
                  id="recipient-email"
                  name="recipientEmail"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  placeholder="alex@example.com"
                  className="h-11 px-3"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError(null);
                  }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "recipient-error" : undefined}
                />
                {error ? (
                  <FieldError id="recipient-error">{error}</FieldError>
                ) : null}
              </Field>
              <Field>
                <Button type="submit" size="lg" className="h-11 w-full">
                  Continue
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </Field>
            </FieldGroup>
          </form>

          <div className="my-6 flex items-center gap-3.5 text-[11px] text-muted-foreground">
            <Separator className="w-auto flex-1" />
            <span>or</span>
            <Separator className="w-auto flex-1" />
          </div>

          <div className="flex flex-col items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="h-11 w-full"
              onClick={skipRecipient}
            >
              Generate secure URL
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
