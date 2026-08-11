import { scryptSync, timingSafeEqual } from "node:crypto";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData, useParams } from "react-router";
import { AppProxyProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import styles from "../styles/proxy.module.css";

const verifyPin = (pin: string, stored: string) => {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const supplied = scryptSync(pin, salt, 64);
  const expected = Buffer.from(key, "hex");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.public.appProxy(request);
  const agreement = await prisma.agreement.findUnique({ where: { accessToken: params.token } });
  const shop = new URL(request.url).searchParams.get("shop");
  const storefrontOrigin = shop && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop)
    ? `https://${shop}`
    : "";
  return {
    exists: Boolean(agreement && !agreement.archivedAt),
    reference: agreement?.reference ?? null,
    appUrl: process.env.SHOPIFY_APP_URL ?? new URL(request.url).origin,
    storefrontOrigin,
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  await authenticate.public.appProxy(request);
  const agreement = await prisma.agreement.findUnique({ where: { accessToken: params.token } });
  if (!agreement || agreement.archivedAt) return { ok: false as const, error: "Agreement not found." };
  const form = await request.formData();
  const pin = String(form.get("pin") || "");
  if (!verifyPin(pin, agreement.pinHash)) return { ok: false as const, error: "The PIN is incorrect." };

  if (form.get("intent") === "sign") {
    const signedName = String(form.get("signedName") || "").trim();
    const signature = String(form.get("signature") || "");
    if (!signedName || !signature.startsWith("data:image/")) {
      return { ok: false as const, error: "Enter your full legal name and draw your signature." };
    }
    const updated = await prisma.agreement.update({
      where: { id: agreement.id },
      data: {
        creatorSignedName: signedName,
        creatorSignature: signature,
        creatorSignedAt: new Date(),
        status: agreement.companySignature ? "COMPLETED" : "AWAITING_COMPANY",
        completedAt: agreement.companySignature ? new Date() : null,
      },
    });
    return { ok: true as const, pin, agreement: updated, signed: true };
  }
  return { ok: true as const, pin, agreement, signed: false };
};

const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;

export default function AgreementPortal() {
  const initial = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const { token } = useParams();
  const agreement = result?.ok ? result.agreement : null;

  if (!initial.exists) return <AppProxyProvider appUrl={initial.appUrl}><main className={styles.access}><section><h1>Agreement unavailable</h1><p>This private link is invalid or has expired.</p></section></main></AppProxyProvider>;
  if (!agreement) {
    return (
      <AppProxyProvider appUrl={initial.appUrl}><main className={styles.access}>
        <section className={styles.accessCard}>
          <div className={styles.logo}>PERFORMANCE <strong>STYLING</strong></div>
          <span>PRIVATE COLLABORATION PORTAL</span>
          <h1>Your agreement is ready.</h1>
          <p>Enter the six-digit PIN sent to you by Performance Styling.</p>
          <form method="post"><label>Access PIN<input name="pin" inputMode="numeric" maxLength={6} required /></label>{result && !result.ok && <p className={styles.error}>{result.error}</p>}<button type="submit">Open agreement →</button></form>
          <small>{initial.reference}</small>
        </section>
      </main></AppProxyProvider>
    );
  }

  return (
    <AppProxyProvider appUrl={initial.appUrl}><main className={styles.portal}>
      <header><div className={styles.logo}>PERFORMANCE <strong>STYLING</strong></div><span>{agreement.reference}</span></header>
      <section className={styles.hero}><span>INFLUENCER COLLABORATION AGREEMENT</span><h1>Built for your drive.<br/><em>Powered by your reach.</em></h1><div><small>PREPARED EXCLUSIVELY FOR</small><h2>{agreement.creatorName}</h2><p>{agreement.socialHandle}</p></div></section>
      {result?.signed && <aside className={styles.success}>✓ Signature saved securely. Performance Styling will complete the company signature.</aside>}
      <section className={styles.content}><div className={styles.intro}><span>01 / YOUR BUILD</span><h2>Bespoke wheel specification</h2></div><article><h3>{agreement.vehicle}</h3><p>{agreement.wheelSpecification}</p></article></section>
      <section className={styles.dark}><span>THE COLLABORATION</span><h2>One partnership. Shared performance.</h2><div className={styles.values}><article><small>WHEEL VALUE</small><strong>{money(agreement.wheelValuePence)}</strong></article><article><small>YOUR CONTRIBUTION</small><strong>{money(agreement.contributionPence)}</strong></article><article><small>SALES TARGET</small><strong>{agreement.salesTarget}</strong></article><article><small>REFUND ON TARGET</small><strong>{money(agreement.refundPence)}</strong></article></div></section>
      <section className={styles.content}><div className={styles.intro}><span>02 / CONTENT PLAN</span><h2>Your deliverables</h2></div><article><p>{agreement.deliverables}</p><hr/><p>{agreement.terms}</p></article></section>
      <section className={styles.sign}>
        <span>FINAL STEP</span><h2>{agreement.creatorSignature ? "Agreement signed." : "Let’s make it official."}</h2>
        {agreement.creatorSignature ? <><img src={agreement.creatorSignature} alt="Creator signature"/><p>Signed by {agreement.creatorSignedName} on {new Date(agreement.creatorSignedAt!).toLocaleString("en-GB")}</p><button onClick={() => window.print()}>Print signed copy</button></> : <SignatureForm pin={result?.ok ? result.pin : ""} />}
      </section>
    </main></AppProxyProvider>
  );
}

function SignatureForm({ pin }: { pin: string }) {
  const { token } = useParams();
  const signatureScript = `(function(){var s=document.currentScript,f=s&&s.closest('form'),c=f&&f.querySelector('canvas'),i=f&&f.querySelector('input[name="signature"]');if(!f||!c||!i)return;var x=c.getContext('2d'),d=false,p=function(e){var r=c.getBoundingClientRect();return[(e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height]};c.addEventListener('pointerdown',function(e){d=true;c.setPointerCapture(e.pointerId);var q=p(e);x.beginPath();x.moveTo(q[0],q[1]);});c.addEventListener('pointermove',function(e){if(!d)return;var q=p(e);x.lineWidth=3;x.lineCap='round';x.strokeStyle='#111';x.lineTo(q[0],q[1]);x.stroke();});var done=function(){if(!d)return;d=false;i.value=c.toDataURL('image/png');};c.addEventListener('pointerup',done);c.addEventListener('pointercancel',done);f.addEventListener('submit',function(e){if(!i.value){e.preventDefault();alert('Please draw your signature before signing.');}});})();`;
  return <form method="post" className={styles.signatureForm}><input type="hidden" name="pin" value={pin}/><input type="hidden" name="intent" value="sign"/><input type="hidden" name="signature"/><label>Full legal name<input name="signedName" required/></label><label>Draw your signature<canvas width="700" height="180"></canvas></label><label className={styles.checkbox}><input type="checkbox" required/> I have read and agree to the collaboration details and terms above.</label><button type="submit">Sign agreement</button><script dangerouslySetInnerHTML={{__html: signatureScript}} /></form>;
}
