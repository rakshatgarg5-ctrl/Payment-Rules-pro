import { redirect } from "react-router";
import { Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server.js";

import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>PayHide: Hide Payment Methods</h1>
        <p className={styles.text}>
          Hide checkout payment methods with conditional rules tailored to your
          store.
        </p>
        <p className={styles.installHint}>
          To install or open the app, go to{" "}
          <strong>Shopify Admin → Apps → PayHide: Hide Payment Methods</strong>.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain (existing installs)</span>
              <input
                className={styles.input}
                type="text"
                name="shop"
                placeholder="your-store.myshopify.com"
                autoComplete="off"
              />
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <p className={styles.footer}>
          <a href="/privacy-policy.html">Privacy Policy</a>
          {" · "}
          SwiftLogic
        </p>
      </div>
    </div>
  );
}
