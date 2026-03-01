import { Resend } from "resend";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

// ---- Client ----

export function getResend(apiKey: string) {
  return new Resend(apiKey);
}

const FROM = "TweetSip <hello@tweetsip.com>";

// ---- Templates ----

function BaseLayout({ preview, children }: { preview: string; children: React.ReactNode }) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f0f4f8", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: 520, margin: "40px auto", backgroundColor: "#ffffff", borderRadius: 16, padding: 32 }}>
          {children}
          <Hr style={{ borderColor: "#e2e8f0", margin: "24px 0" }} />
          <Text style={{ fontSize: 12, color: "#a0aec0", textAlign: "center" }}>
            TweetSip · <Link href="{{{unsubscribe}}}" style={{ color: "#a0aec0" }}>Unsubscribe</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Magic link email (replaces the console.log in auth.ts)
export function MagicLinkEmail({ url }: { url: string }) {
  return (
    <BaseLayout preview="Your TweetSip sign-in link">
      <Heading style={{ fontSize: 20, fontWeight: 800, color: "#1a202c" }}>
        Sign in to TweetSip ☕
      </Heading>
      <Text style={{ color: "#4a5568", fontSize: 14 }}>
        Click the button below to sign in. This link expires in 10 minutes.
      </Text>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <Link
          href={url}
          style={{
            backgroundColor: "#1a202c",
            color: "#ffffff",
            padding: "12px 24px",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Sign in →
        </Link>
      </Section>
      <Text style={{ color: "#a0aec0", fontSize: 12 }}>
        If you didn't request this, you can safely ignore this email.
      </Text>
    </BaseLayout>
  );
}

// Daily digest with briefings for each tracked account
export type DigestAccount = {
  handle: string;
  name: string | null;
  moment: string;
  forYou: string;
  engagementScore: number;
};

export function DailyDigestEmail({
  accounts,
  appUrl,
}: {
  accounts: DigestAccount[];
  appUrl: string;
}) {
  return (
    <BaseLayout preview={`Your daily briefing — ${accounts.length} accounts`}>
      <Heading style={{ fontSize: 20, fontWeight: 800, color: "#1a202c" }}>
        Your daily briefing ☕
      </Heading>
      <Text style={{ color: "#4a5568", fontSize: 14, marginBottom: 24 }}>
        Here's what happened with the accounts you're tracking.
      </Text>

      {accounts.map((a) => (
        <Section
          key={a.handle}
          style={{ borderLeft: "3px solid #e2e8f0", paddingLeft: 16, marginBottom: 24 }}
        >
          <Text style={{ fontWeight: 700, color: "#1a202c", fontSize: 15, margin: "0 0 4px" }}>
            {a.name ?? a.handle}{" "}
            <span style={{ fontWeight: 400, color: "#a0aec0", fontSize: 13 }}>{a.handle}</span>
          </Text>
          <Text style={{ color: "#4a5568", fontSize: 13, margin: "0 0 8px" }}>{a.moment}</Text>
          <Text style={{ color: "#718096", fontSize: 12, margin: 0 }}>→ {a.forYou}</Text>
        </Section>
      ))}

      <Section style={{ textAlign: "center" }}>
        <Link
          href={appUrl}
          style={{ color: "#1a202c", fontSize: 13, fontWeight: 600 }}
        >
          Open full feed →
        </Link>
      </Section>
    </BaseLayout>
  );
}

// Alert for a strong signal (high engagement spike)
export function StrongSignalEmail({
  handle,
  moment,
  appUrl,
}: {
  handle: string;
  moment: string;
  appUrl: string;
}) {
  return (
    <BaseLayout preview={`${handle} is making moves — check it out`}>
      <Heading style={{ fontSize: 20, fontWeight: 800, color: "#1a202c" }}>
        🔥 Strong signal detected
      </Heading>
      <Text style={{ color: "#4a5568", fontSize: 14 }}>
        <strong>{handle}</strong> is seeing unusual activity.
      </Text>
      <Section style={{ backgroundColor: "#f0f4f8", borderRadius: 12, padding: 16, margin: "16px 0" }}>
        <Text style={{ color: "#1a202c", fontSize: 14, margin: 0 }}>{moment}</Text>
      </Section>
      <Section style={{ textAlign: "center" }}>
        <Link
          href={appUrl}
          style={{ color: "#1a202c", fontSize: 13, fontWeight: 600 }}
        >
          View briefing →
        </Link>
      </Section>
    </BaseLayout>
  );
}

// Alert for account silence (no posts in 48h)
export function SilenceAlertEmail({
  handle,
  hourssilent,
  appUrl,
}: {
  handle: string;
  hourssilent: number;
  appUrl: string;
}) {
  return (
    <BaseLayout preview={`${handle} has been silent for ${hourssilent}h`}>
      <Heading style={{ fontSize: 20, fontWeight: 800, color: "#1a202c" }}>
        🤫 Unusual silence
      </Heading>
      <Text style={{ color: "#4a5568", fontSize: 14 }}>
        <strong>{handle}</strong> hasn't posted in {hourssilent} hours — that's unusual for them.
      </Text>
      <Section style={{ textAlign: "center", marginTop: 24 }}>
        <Link
          href={appUrl}
          style={{ color: "#1a202c", fontSize: 13, fontWeight: 600 }}
        >
          Open TweetSip →
        </Link>
      </Section>
    </BaseLayout>
  );
}

// ---- Send helpers ----

export async function sendMagicLink(resend: Resend, to: string, url: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Your TweetSip sign-in link",
    react: <MagicLinkEmail url={url} />,
  });
}

export async function sendDailyDigest(
  resend: Resend,
  to: string,
  accounts: DigestAccount[],
  appUrl: string,
) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Your daily briefing ☕",
    react: <DailyDigestEmail accounts={accounts} appUrl={appUrl} />,
  });
}

export async function sendStrongSignal(
  resend: Resend,
  to: string,
  handle: string,
  moment: string,
  appUrl: string,
) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `🔥 ${handle} is making moves`,
    react: <StrongSignalEmail handle={handle} moment={moment} appUrl={appUrl} />,
  });
}

export async function sendSilenceAlert(
  resend: Resend,
  to: string,
  handle: string,
  hoursSilent: number,
  appUrl: string,
) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `🤫 ${handle} has gone quiet`,
    react: <SilenceAlertEmail handle={handle} hourssilent={hoursSilent} appUrl={appUrl} />,
  });
}
