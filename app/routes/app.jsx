import {
  Outlet,
  useLoaderData,
  useLocation,
  useNavigation,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { ListLoadingState } from "../components/ListLoadingState.jsx";
import { authenticateAdmin } from "../shopify.server.js";
import { withSearch } from "../utils/app-path.js";

export const loader = async ({ request }) => {
  await authenticateAdmin(request);

  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();
  const location = useLocation();
  const navigation = useNavigation();
  const homeHref = withSearch("/app", location.search);
  const supportHref = withSearch("/app/support", location.search);
  const isRouteLoading = navigation.state === "loading";

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href={homeHref} rel="home">
          Payment rules
        </s-link>
        <s-link href={supportHref}>Support & tutorials</s-link>
      </s-app-nav>
      {isRouteLoading ? (
        <s-box padding="large">
          <ListLoadingState message="Loading page…" />
        </s-box>
      ) : (
        <Outlet />
      )}
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
