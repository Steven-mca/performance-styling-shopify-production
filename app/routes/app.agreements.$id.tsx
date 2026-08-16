import { useEffect, useRef, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useActionData, useLoaderData, useNavigate, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import styles from "../styles/adminAgreement.module.css";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const agreement = await prisma.agreement.findFirst({
    where: { id: params.id, shop: session.shop },
    include: { changes: { orderBy: { createdAt: "desc" } } },
  });
  if (!agreement) throw new Response("Agreement not found", { status: 404 });
  return { agreement };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "sign");
  const existing = await prisma.agreement.findFirst({
    where: { id: params.id, shop: session.shop },
  });
  if (!existing) throw new Response("Agreement not found", { status: 404 });

  if (intent === "archive") {
    await prisma.agreement.update({
      where: { id: existing.id },
      data: { archivedAt: new Date() },
    });
    return redirect("/app");
  }

  if (intent === "restore") {
    await prisma.agreement.update({
      where: { id: existing.id },
      data: { archivedAt: null },
    });
    return redirect("/app");
  }

  if (intent === "delete") {
    if (existing.creatorSignature || existing.companySignature) {
      return { ok: false as const, error: "Signed agreements cannot be deleted. Archive this agreement instead." };
    }
    await prisma.agreement.delete({ where: { id: existing.id } });
    return redirect("/app");
  }

  const companySignerName = String(form.get("companySignerName") || "").trim();
  const companySignature = String(form.get("companySignature") || "");
  if (!companySignerName || !companySignature.startsWith("data:image/png;base64,")) {
    return { ok: false as const, error: "Enter your name and draw your signature." };
  }
  const completed = Boolean(existing.creatorSignature);
  await prisma.agreement.update({
    where: { id: existing.id },
    data: {
      companySignedName: companySignerName,
      companySignature,
      companySignedAt: new Date(),
      status: completed ? "COMPLETED" : "AWAITING_CREATOR",
      completedAt: completed ? new Date() : null,
    },
  });
  return { ok: true as const };
};

const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);

const changeValue = (value: unknown) => {
  if (value === null || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  return String(value);
};

function SignaturePad() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [signature, setSignature] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.lineWidth = 2;
    context.lineCap = "round";
    context.strokeStyle = "#111827";
    let drawing = false;
    const point = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
    };
    const down = (event: PointerEvent) => {
      drawing = true;
      canvas.setPointerCapture(event.pointerId);
      const p = point(event);
      context.beginPath();
      context.moveTo(p.x, p.y);
    };
    const move = (event: PointerEvent) => {
      if (!drawing) return;
      const p = point(event);
      context.lineTo(p.x, p.y);
      context.stroke();
    };
    const up = () => {
      if (!drawing) return;
      drawing = false;
      setSignature(canvas.toDataURL("image/png"));
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
  }, []);

  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setSignature("");
  };

  return (
    <div>
      <canvas ref={canvasRef} width={760} height={180} className={styles.canvas} aria-label="Company signature pad" />
      <input type="hidden" name="companySignature" value={signature} />
      <div className={styles.clear}><s-button type="button" variant="tertiary" onClick={clear}>Clear signature</s-button></div>
    </div>
  );
}

export default function AgreementDetails() {
  const { agreement } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const storefrontPath = `/apps/collab/${agreement.accessToken}/`;

  return (
    <s-page heading={agreement.reference} inlineSize="base">
      <s-link slot="breadcrumb-actions" href="/app">Agreements</s-link>
      <s-button
        slot="primary-action"
        icon="edit"
        onClick={() => navigate(`/app/agreements/${agreement.id}/edit`)}
      >
        Edit agreement
      </s-button>
      <s-button slot="secondary-actions" onClick={() => window.print()}>Print signed copy</s-button>
      <s-section heading="Agreement details">
        <s-stack direction="block" gap="base">
          {result?.ok && <s-banner tone="success" heading="Company signature saved">The agreement status has been updated.</s-banner>}
          {result && !result.ok && <s-banner tone="critical">{result.error}</s-banner>}
          <s-grid gridTemplateColumns="1fr 1fr" gap="base">
            <s-box><s-paragraph color="subdued">Creator</s-paragraph><s-text type="strong">{agreement.creatorName}</s-text></s-box>
            <s-box><s-paragraph color="subdued">Email</s-paragraph><s-text>{agreement.creatorEmail}</s-text></s-box>
            <s-box><s-paragraph color="subdued">Vehicle</s-paragraph><s-text>{agreement.vehicle}</s-text></s-box>
            <s-box><s-paragraph color="subdued">Creator contribution</s-paragraph><s-text>{money(agreement.contributionPence)}</s-text></s-box>
            <s-box><s-paragraph color="subdued">Sales target</s-paragraph><s-text>{agreement.salesTarget}</s-text></s-box>
            <s-box>
              <s-paragraph color="subdued">Refund on target</s-paragraph>
              <s-text>{agreement.refundEnabled ? money(agreement.refundPence) : "Disabled"}</s-text>
            </s-box>
          </s-grid>
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-paragraph color="subdued">Creator storefront path</s-paragraph><s-text type="strong">{storefrontPath}</s-text>
          </s-box>
          <s-heading>Deliverables</s-heading><s-paragraph>{agreement.deliverables}</s-paragraph>
          <s-heading>Terms</s-heading><s-paragraph>{agreement.terms}</s-paragraph>
        </s-stack>
      </s-section>

      <s-section heading="Change log">
        {agreement.changes.length === 0 ? (
          <s-paragraph color="subdued">No changes have been made since this agreement was created.</s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            {agreement.changes.map((entry) => {
              const fields = entry.changes as Record<string, { from: unknown; to: unknown }>;
              return (
                <s-box key={entry.id} padding="base" border="base" borderRadius="base">
                  <s-stack direction="block" gap="small">
                    <s-text type="strong">{new Date(entry.createdAt).toLocaleString("en-GB")}</s-text>
                    <s-paragraph color="subdued">Changed by {entry.changedBy || "Shopify admin"}</s-paragraph>
                    <s-unordered-list>
                      {Object.entries(fields).map(([field, values]) => (
                        <s-list-item key={field}>
                          {field}: {changeValue(values.from)} → {changeValue(values.to)}
                        </s-list-item>
                      ))}
                    </s-unordered-list>
                  </s-stack>
                </s-box>
              );
            })}
          </s-stack>
        )}
      </s-section>

      <s-section heading="Agreement management">
        <s-stack direction="block" gap="base">
          {agreement.archivedAt ? (
            <>
              <s-banner tone="warning" heading="Agreement archived">
                Its private creator link is disabled until the agreement is restored.
              </s-banner>
              <Form method="post">
                <input type="hidden" name="intent" value="restore" />
                <s-button type="submit">Restore agreement</s-button>
              </Form>
            </>
          ) : (
            <Form method="post">
              <input type="hidden" name="intent" value="archive" />
              <s-button type="submit">Archive agreement</s-button>
            </Form>
          )}
          {!agreement.creatorSignature && !agreement.companySignature && (
            <Form
              method="post"
              onSubmit={(event) => {
                if (!window.confirm("Permanently delete this unsigned agreement? This cannot be undone.")) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="intent" value="delete" />
              <s-button type="submit" tone="critical">Delete unsigned agreement</s-button>
            </Form>
          )}
          {(agreement.creatorSignature || agreement.companySignature) && (
            <s-paragraph color="subdued">Signed agreements are retained for audit purposes and can only be archived.</s-paragraph>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Signatures">
        <s-stack direction="block" gap="base">
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-heading>Creator</s-heading>
            {agreement.creatorSignature ? <img className={styles.signature} src={agreement.creatorSignature} alt={`Signature of ${agreement.creatorSignedName}`} /> : <s-paragraph>Awaiting creator signature.</s-paragraph>}
          </s-box>
          {agreement.companySignature ? (
            <s-box padding="base" background="subdued" borderRadius="base">
              <s-heading>Performance Styling</s-heading>
              <img className={styles.signature} src={agreement.companySignature} alt={`Signature of ${agreement.companySignedName}`} />
              <s-paragraph>Signed by {agreement.companySignedName}</s-paragraph>
            </s-box>
          ) : (
            <Form method="post">
              <s-stack direction="block" gap="base">
                <s-text-field label="Your full name" name="companySignerName" required></s-text-field>
                <s-paragraph>Draw your signature below.</s-paragraph>
                <SignaturePad />
                <s-button type="submit" variant="primary" loading={navigation.state === "submitting"}>Sign for Performance Styling</s-button>
              </s-stack>
            </Form>
          )}
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (args) => boundary.headers(args);
