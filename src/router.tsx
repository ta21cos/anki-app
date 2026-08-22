import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { BottomNav } from "@/components/bottom-nav";
import { SWRProvider } from "@/lib/api/swr-provider";
import { HomePage } from "@/pages/home";
import { SessionPage } from "@/pages/session";
import { ImportPage } from "@/pages/import";
import { StatsPage } from "@/pages/stats";
import { StudyPage } from "@/pages/study";
import { ListenPage } from "@/pages/listen";
import { DeckEditPage } from "@/pages/deck-edit";

const rootRoute = createRootRoute({
  component: () => (
    <SWRProvider>
      <main className="pb-16">
        <Outlet />
      </main>
      <BottomNav />
    </SWRProvider>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/session",
  component: SessionPage,
});

// NOTE: 旧 URL のブックマーク互換のため /daily は /session へ転送する。
const dailyRedirectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/daily",
  beforeLoad: () => {
    throw redirect({ to: "/session" });
  },
});

const importRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/import",
  component: ImportPage,
});

const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stats",
  component: StatsPage,
});

const studyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/study/$deckId",
  component: StudyPage,
});

const listenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/listen/$deckId",
  component: ListenPage,
});

const deckEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/deck/$deckId/edit",
  component: DeckEditPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  sessionRoute,
  dailyRedirectRoute,
  importRoute,
  statsRoute,
  studyRoute,
  listenRoute,
  deckEditRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
