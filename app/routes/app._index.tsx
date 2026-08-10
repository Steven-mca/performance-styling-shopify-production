import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const agreements = await prisma.agreement.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
  });
  return { agreements };
};

const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);

const tone = (status: string) => {
  if (status === "COMPLETED") return "success";
  if (status === "AWAITING_COMPANY") return "warning";
  return "info";
};

const label = (status: string) => status.toLowerCase().replaceAll("_", " ");

export default function AgreementsIndex() {
  const { agreements } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Influencer agreements" inlineSize="large">
      <s-button slot="primary-action" href="/app/new" variant="primary">Create agreement</s-button>
      <s-section heading="Collaboration overview">
        <s-grid gridTemplateColumns="repeat(3, minmax(0, 1fr))" gap="base">
          <s-box padding="base" border="base" borderRadius="base">
            <s-paragraph color="subdued">Total agreements</s-paragraph>
            <s-heading>{agreements.length}</s-heading>
          </s-box>
          <s-box padding="base" border="base" borderRadius="base">
            <s-paragraph color="subdued">Awaiting signatures</s-paragraph>
            <s-heading>{agreements.filter((a) => a.status !== "COMPLETED").length}</s-heading>
          </s-box>
          <s-box padding="base" border="base" borderRadius="base">
            <s-paragraph color="subdued">Completed</s-paragraph>
            <s-heading>{agreements.filter((a) => a.status === "COMPLETED").length}</s-heading>
          </s-box>
        </s-grid>
      </s-section>

      <s-section heading="Agreements">
        {agreements.length === 0 ? (
          <s-box padding="large" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="base" alignItems="center">
              <s-heading>No agreements yet</s-heading>
              <s-paragraph>Create the first private influencer agreement and send its unique link and PIN.</s-paragraph>
              <s-button href="/app/new" variant="primary">Create agreement</s-button>
            </s-stack>
          </s-box>
        ) : (
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header listSlot="primary">Creator</s-table-header>
              <s-table-header listSlot="labeled">Reference</s-table-header>
              <s-table-header listSlot="labeled">Vehicle</s-table-header>
              <s-table-header listSlot="labeled" format="currency">Contribution</s-table-header>
              <s-table-header listSlot="labeled">Status</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {agreements.map((agreement) => (
                <s-table-row key={agreement.id}>
                  <s-table-cell><s-link href={`/app/agreements/${agreement.id}`}>{agreement.creatorName}</s-link></s-table-cell>
                  <s-table-cell>{agreement.reference}</s-table-cell>
                  <s-table-cell>{agreement.vehicle}</s-table-cell>
                  <s-table-cell>{money(agreement.contributionPence)}</s-table-cell>
                  <s-table-cell><s-badge tone={tone(agreement.status)}>{label(agreement.status)}</s-badge></s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (args) => boundary.headers(args);
