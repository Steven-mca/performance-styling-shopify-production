import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const required = (form: FormData, key: string) => String(form.get(key) || "").trim();
const poundsToPence = (value: string) => Math.round(Number(value) * 100);
const penceToPounds = (value: number) => (value / 100).toFixed(2);

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const agreement = await prisma.agreement.findFirst({
    where: { id: params.id, shop: session.shop },
  });
  if (!agreement) throw new Response("Agreement not found", { status: 404 });
  return { agreement };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const existing = await prisma.agreement.findFirst({
    where: { id: params.id, shop: session.shop },
  });
  if (!existing) throw new Response("Agreement not found", { status: 404 });
  if (existing.archivedAt) {
    return { ok: false as const, error: "Restore this agreement before editing it." };
  }

  const form = await request.formData();
  const creatorName = required(form, "creatorName");
  const creatorEmail = required(form, "creatorEmail");
  const vehicle = required(form, "vehicle");
  if (!creatorName || !creatorEmail || !vehicle) {
    return { ok: false as const, error: "Creator name, email and vehicle are required." };
  }

  const next = {
    creatorName,
    creatorEmail,
    socialHandle: required(form, "socialHandle") || null,
    vehicle,
    wheelSpecification: required(form, "wheelSpecification") || "Bespoke steering wheel specification to be confirmed",
    deliverables: required(form, "deliverables"),
    terms: required(form, "terms"),
    wheelValuePence: poundsToPence(required(form, "wheelValue") || "0"),
    contributionPence: poundsToPence(required(form, "contribution") || "0"),
    salesTarget: Number(required(form, "salesTarget") || 0),
    refundEnabled: form.get("refundEnabled") === "enabled",
    refundPence: poundsToPence(required(form, "refundValue") || "0"),
  };

  const changes: Record<string, { from: string | number | boolean | null; to: string | number | boolean | null }> = {};
  const record = (
    label: string,
    from: string | number | boolean | null,
    to: string | number | boolean | null,
  ) => {
    if (from !== to) changes[label] = { from, to };
  };
  record("Creator name", existing.creatorName, next.creatorName);
  record("Creator email", existing.creatorEmail, next.creatorEmail);
  record("Social handle", existing.socialHandle, next.socialHandle);
  record("Vehicle", existing.vehicle, next.vehicle);
  record("Wheel specification", existing.wheelSpecification, next.wheelSpecification);
  record("Deliverables", existing.deliverables, next.deliverables);
  record("Terms", existing.terms, next.terms);
  record("Wheel value (pence)", existing.wheelValuePence, next.wheelValuePence);
  record("Contribution (pence)", existing.contributionPence, next.contributionPence);
  record("Sales target", existing.salesTarget, next.salesTarget);
  record("Refund enabled", existing.refundEnabled, next.refundEnabled);
  record("Refund value (pence)", existing.refundPence, next.refundPence);

  if (Object.keys(changes).length === 0) return redirect(`/app/agreements/${existing.id}`);

  const hadSignature = Boolean(existing.creatorSignature || existing.companySignature);
  if (hadSignature) {
    changes["Signatures"] = {
      from: "Previously signed",
      to: "Cleared - revised agreement requires new signatures",
    };
  }

  await prisma.$transaction([
    prisma.agreement.update({
      where: { id: existing.id },
      data: {
        ...next,
        ...(hadSignature ? {
          creatorSignature: null,
          creatorSignedName: null,
          creatorSignedAt: null,
          companySignature: null,
          companySignedName: null,
          companySignedAt: null,
          completedAt: null,
          status: "AWAITING_CREATOR",
        } : {}),
      },
    }),
    prisma.agreementChange.create({
      data: {
        agreementId: existing.id,
        changedBy: "Shopify admin",
        changes,
      },
    }),
  ]);

  return redirect(`/app/agreements/${existing.id}`);
};

export default function EditAgreement() {
  const { agreement } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <s-page heading={`Edit ${agreement.reference}`} inlineSize="small">
      <s-link slot="breadcrumb-actions" href={`/app/agreements/${agreement.id}`}>Agreement</s-link>
      <s-section heading="Agreement terms">
        <s-stack direction="block" gap="base">
          <s-banner tone="warning" heading="Edits are recorded">
            If either party has already signed, saving changes clears both signatures and requires the revised agreement to be signed again.
          </s-banner>
          {result && !result.ok && <s-banner tone="critical">{result.error}</s-banner>}
          <Form method="post">
            <s-stack direction="block" gap="base">
              <s-text-field label="Creator name" name="creatorName" value={agreement.creatorName} required></s-text-field>
              <s-email-field label="Creator email" name="creatorEmail" value={agreement.creatorEmail} required></s-email-field>
              <s-text-field label="Social handle" name="socialHandle" value={agreement.socialHandle || ""}></s-text-field>
              <s-text-field label="Vehicle" name="vehicle" value={agreement.vehicle} required></s-text-field>
              <s-text-area label="Wheel specification" name="wheelSpecification" rows={4} value={agreement.wheelSpecification}></s-text-area>
              <s-divider></s-divider>
              <s-heading>Commercial terms</s-heading>
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <s-money-field label="Wheel retail value" name="wheelValue" value={penceToPounds(agreement.wheelValuePence)}></s-money-field>
                <s-money-field label="Creator contribution" name="contribution" value={penceToPounds(agreement.contributionPence)}></s-money-field>
                <s-number-field label="Sales target" name="salesTarget" value={String(agreement.salesTarget)} min={1}></s-number-field>
                <s-money-field label="Refund when achieved" name="refundValue" value={penceToPounds(agreement.refundPence)}></s-money-field>
              </s-grid>
              <s-checkbox
                label="Offer a refund when the sales target is achieved"
                name="refundEnabled"
                value="enabled"
                defaultChecked={agreement.refundEnabled}
                details="When disabled, the sales target remains visible but the refund offer is hidden from the creator."
              ></s-checkbox>
              <s-text-area label="Content deliverables" name="deliverables" rows={4} value={agreement.deliverables}></s-text-area>
              <s-text-area label="Additional terms" name="terms" rows={5} value={agreement.terms}></s-text-area>
              <s-button-group>
                <s-button type="submit" variant="primary" loading={navigation.state === "submitting"}>Save revised agreement</s-button>
                <s-button href={`/app/agreements/${agreement.id}`}>Cancel</s-button>
              </s-button-group>
            </s-stack>
          </Form>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (args) => boundary.headers(args);
