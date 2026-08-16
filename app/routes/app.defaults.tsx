import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { DEFAULT_DELIVERABLES, DEFAULT_TERMS } from "../agreement-defaults.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const saved = await prisma.agreementDefault.findUnique({ where: { shop: session.shop } });
  return {
    deliverables: saved?.deliverables || DEFAULT_DELIVERABLES,
    terms: saved?.terms || DEFAULT_TERMS,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const deliverables = String(form.get("deliverables") || "").trim();
  const terms = String(form.get("terms") || "").trim();
  if (!deliverables || !terms) {
    return { ok: false as const, error: "Default deliverables and terms cannot be empty." };
  }
  await prisma.agreementDefault.upsert({
    where: { shop: session.shop },
    update: { deliverables, terms },
    create: { shop: session.shop, deliverables, terms },
  });
  return { ok: true as const };
};

export default function AgreementDefaults() {
  const defaults = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const saving = navigation.state === "submitting";

  return (
    <Form method="post">
      <s-page heading="Agreement defaults" inlineSize="base">
        <s-button slot="primary-action" type="submit" variant="primary" icon="save" loading={saving}>
          Save defaults
        </s-button>
        <s-section heading="Default agreement wording">
          <s-stack direction="block" gap="base">
            <s-banner tone="warning" heading="Obtain legal review before relying on these terms">
              These defaults are a practical England and Wales template, not a substitute for advice from a solicitor who understands your business and each collaboration.
            </s-banner>
            {result?.ok && <s-banner tone="success">Agreement defaults saved.</s-banner>}
            {result && !result.ok && <s-banner tone="critical">{result.error}</s-banner>}
            <s-text-area
              label="Default content deliverables"
              name="deliverables"
              rows={5}
              value={defaults.deliverables}
              details="These are copied into each new agreement and can still be changed before sending."
            ></s-text-area>
            <s-text-area
              label="Default terms and conditions"
              name="terms"
              rows={28}
              value={defaults.terms}
              details="Changing the defaults affects new agreements only. Existing agreements are unchanged."
            ></s-text-area>
            <s-button type="submit" variant="primary" icon="save" loading={saving}>Save defaults</s-button>
          </s-stack>
        </s-section>
      </s-page>
    </Form>
  );
}

export const headers: HeadersFunction = (args) => boundary.headers(args);
