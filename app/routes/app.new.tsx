import { randomBytes, scryptSync } from "node:crypto";
import { useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

const required = (form: FormData, key: string) => String(form.get(key) || "").trim();
const poundsToPence = (value: string) => Math.round(Number(value) * 100);

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const creatorName = required(form, "creatorName");
  const creatorEmail = required(form, "creatorEmail");
  const vehicle = required(form, "vehicle");
  if (!creatorName || !creatorEmail || !vehicle) {
    return { ok: false as const, error: "Creator name, email and vehicle are required." };
  }

  const pin = String(Math.floor(100000 + Math.random() * 900000));
  const salt = randomBytes(16).toString("hex");
  const pinHash = `${salt}:${scryptSync(pin, salt, 64).toString("hex")}`;
  const accessToken = randomBytes(9).toString("base64url");
  const existingReferences = await prisma.agreement.findMany({
    where: { reference: { startsWith: "PS-INF-" } },
    select: { reference: true },
  });
  let nextReferenceNumber = existingReferences.reduce((highest, item) => {
    const match = /^PS-INF-(\d+)$/.exec(item.reference);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0) + 1;

  const agreementData = {
      shop: session.shop,
      accessToken,
      pinHash,
      creatorName,
      creatorEmail,
      socialHandle: required(form, "socialHandle") || null,
      vehicle,
      wheelSpecification: required(form, "wheelSpecification") || "Bespoke steering wheel specification to be confirmed",
      deliverables: required(form, "deliverables") || "3 video posts, 3 static posts and 6 stories within 30 days",
      terms: required(form, "terms") || "Each publication on an individual social platform counts as one deliverable. Qualifying sales must be completed and non-refunded.",
      wheelValuePence: poundsToPence(required(form, "wheelValue") || "350"),
      contributionPence: poundsToPence(required(form, "contribution") || "150"),
      salesTarget: Number(required(form, "salesTarget") || 5),
      refundPence: poundsToPence(required(form, "refundValue") || "150"),
  };

  let agreement: Awaited<ReturnType<typeof prisma.agreement.create>> | null = null;
  let reference = "";
  for (let attempt = 0; attempt < 5 && !agreement; attempt += 1) {
    reference = `PS-INF-${String(nextReferenceNumber + attempt).padStart(4, "0")}`;
    try {
      agreement = await prisma.agreement.create({
        data: { ...agreementData, reference },
      });
    } catch (error) {
      const isDuplicateReference =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002";
      if (!isDuplicateReference) throw error;
    }
  }
  if (!agreement) {
    return { ok: false as const, error: "A unique agreement reference could not be generated. Please try again." };
  }

  return { ok: true as const, pin, reference, accessToken: agreement.accessToken, creatorName };
};

export default function NewAgreement() {
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const [copied, setCopied] = useState(false);
  const saving = navigation.state === "submitting";

  if (result?.ok) {
    const agreementUrl = `https://performancebodykits.com/apps/collab/${result.accessToken}/`;
    const influencerMessage = `Hey ${result.creatorName}! We’ve drawn up your collaboration proposal with Performance Styling. You can view it here:\n\n${agreementUrl}\n\nIf you’re happy with everything, please enter the access code below and sign the agreement so we can get started on the collaboration.\n\nAccess code: ${result.pin}\n\nIf you have any questions, just let us know!`;

    const copyMessage = async () => {
      try {
        await navigator.clipboard.writeText(influencerMessage);
        setCopied(true);
      } catch {
        window.prompt("Copy this message:", influencerMessage);
      }
    };

    return (
      <s-page heading="Agreement created" inlineSize="small">
        <s-section>
          <s-banner heading="Save these access details now" tone="success">
            The PIN is shown only once. Send the link and PIN separately to the creator.
          </s-banner>
          <s-stack direction="block" gap="base">
            <s-box padding="base" background="subdued" borderRadius="base">
              <s-paragraph color="subdued">Reference</s-paragraph><s-heading>{result.reference}</s-heading>
            </s-box>
            <s-box padding="base" background="subdued" borderRadius="base">
              <s-paragraph color="subdued">Private storefront path</s-paragraph><s-text type="strong">/apps/collab/{result.accessToken}/</s-text>
            </s-box>
            <s-box padding="base" background="subdued" borderRadius="base">
              <s-paragraph color="subdued">Access PIN</s-paragraph><s-heading>{result.pin}</s-heading>
            </s-box>
            <s-box padding="base" border="base" borderRadius="base">
              <s-stack direction="block" gap="base">
                <s-heading>Message for the influencer</s-heading>
                <s-text-area
                  label="Ready to send"
                  value={influencerMessage}
                  rows={9}
                  readOnly
                ></s-text-area>
                <s-button type="button" variant="primary" onClick={copyMessage}>
                  {copied ? "Message copied" : "Copy message"}
                </s-button>
              </s-stack>
            </s-box>
            <s-button href="/app" variant="primary">Return to agreements</s-button>
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Create influencer agreement" inlineSize="small">
      <s-button slot="secondary-actions" href="/app">Cancel</s-button>
      <s-section heading="Creator and vehicle">
        {result && !result.ok && <s-banner tone="critical">{result.error}</s-banner>}
        <Form method="post">
          <s-stack direction="block" gap="base">
            <s-text-field label="Creator name" name="creatorName" required></s-text-field>
            <s-email-field label="Creator email" name="creatorEmail" required></s-email-field>
            <s-text-field label="Social handle" name="socialHandle" placeholder="@creator"></s-text-field>
            <s-text-field label="Vehicle" name="vehicle" placeholder="VW Golf MK7" required></s-text-field>
            <s-text-area label="Wheel specification" name="wheelSpecification" rows={4}></s-text-area>
            <s-divider></s-divider>
            <s-heading>Commercial terms</s-heading>
            <s-grid gridTemplateColumns="1fr 1fr" gap="base">
              <s-money-field label="Wheel retail value" name="wheelValue" value="350"></s-money-field>
              <s-money-field label="Creator contribution" name="contribution" value="150"></s-money-field>
              <s-number-field label="Sales target" name="salesTarget" value="5" min={1}></s-number-field>
              <s-money-field label="Refund when achieved" name="refundValue" value="150"></s-money-field>
            </s-grid>
            <s-text-area label="Content deliverables" name="deliverables" rows={4} value="3 video posts, 3 static posts and 6 stories within 30 days"></s-text-area>
            <s-text-area label="Additional terms" name="terms" rows={5}></s-text-area>
            <s-button type="submit" variant="primary" loading={saving}>Create private agreement</s-button>
          </s-stack>
        </Form>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (args) => boundary.headers(args);
