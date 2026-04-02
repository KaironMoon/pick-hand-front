import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import Home from "../pages/home";
import Info from "../pages/info";
import GamePage from "../pages/t9game";
import PatternPage from "../pages/t9game/pattern.jsx";
import SetupPage from "../pages/t9game/setup.jsx";
import CurrentSetupPage from "../pages/t9game/current-setup.jsx";
import UserGamePage from "../pages/t9game/user-game.jsx";
import HbGamePage from "../pages/hbgame";
import HbUserGamePage from "../pages/hbgame/user-game.jsx";
import HbSetupPage from "../pages/hbgame/setup.jsx";
import GhGamePage from "../pages/ghgame";
import GhUserGamePage from "../pages/ghgame/user-game.jsx";
import GhSetupPage from "../pages/ghgame/setup.jsx";
import T9UserSetupPage from "../pages/t9game/user-setup.jsx";
import HbUserSetupPage from "../pages/hbgame/user-setup.jsx";
import GhUserSetupPage from "../pages/ghgame/user-setup.jsx";
import NcGamePage from "../pages/ncgame";
import NcUserGamePage from "../pages/ncgame/user-game.jsx";
import NcSetupPage from "../pages/ncgame/setup.jsx";
import NcCurrentSetupPage from "../pages/ncgame/current-setup.jsx";
import NcUserSetupPage from "../pages/ncgame/user-setup.jsx";
import NcPatternPage from "../pages/ncgame/pattern.jsx";
import NotFound from "../pages/error/NotFound";
import PageLayout from "../pages/PageLayout";
import LoginPage from "../pages/login";
import UsersPage from "../pages/users";
import AppSettingsPage from "../pages/app-settings";
import ProtectedRoute from "../pages/components/ProtectedRoute";
import GameGuard from "../pages/components/GameGuard";
import { Navigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { userAtom } from "../store/auth-store";

function RootRedirect() {
  const user = useAtomValue(userAtom);
  return <Navigate to={user?.role === "admin" ? "/t9game" : "/t9game/user"} replace />;
}

const ProductLayout = lazy(() => import("../pages/product/ProductLayout"));
const ProductList = lazy(() => import("../pages/product"));
const ProductDetail = lazy(() => import("../pages/product/ProductDetail"));

const ProductRouter = [
  {
    path: "/product",
    element: <ProductLayout />,
    children: [
      {
        path: "/product",
        element: <ProductList />,
      },
      {
        path: "/product/:id",
        element: <ProductDetail />,
      },
    ],
  },
];

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <PageLayout />,
        children: [
          {
            path: "/",
            element: <Home />,
          },
          {
            path: "/info",
            element: <Info />,
          },
          {
            path: "/t9game/user",
            element: <GameGuard gameType="t9"><UserGamePage /></GameGuard>,
          },
          {
            path: "/t9game/current-setup",
            element: <CurrentSetupPage />,
          },
          {
            path: "/t9game/user-setup",
            element: <T9UserSetupPage />,
          },
          {
            path: "/hbgame/user",
            element: <GameGuard gameType="hb"><HbUserGamePage /></GameGuard>,
          },
          {
            path: "/hbgame/user-setup",
            element: <HbUserSetupPage />,
          },
          {
            path: "/ghgame/user",
            element: <GameGuard gameType="gh"><GhUserGamePage /></GameGuard>,
          },
          {
            path: "/ghgame/user-setup",
            element: <GhUserSetupPage />,
          },
          {
            path: "/ncgame/user",
            element: <GameGuard gameType="nc"><NcUserGamePage /></GameGuard>,
          },
          {
            path: "/ncgame/current-setup",
            element: <NcCurrentSetupPage />,
          },
          {
            path: "/ncgame/user-setup",
            element: <NcUserSetupPage />,
          },
          {
            element: <ProtectedRoute adminOnly />,
            children: [
              {
                path: "/t9game",
                element: <GamePage />,
              },
              {
                path: "/t9game/setup",
                element: <SetupPage />,
              },
              {
                path: "/patterns",
                element: <PatternPage />,
              },
              {
                path: "/users",
                element: <UsersPage />,
              },
              {
                path: "/app-settings",
                element: <AppSettingsPage />,
              },
              {
                path: "/hbgame",
                element: <HbGamePage />,
              },
              {
                path: "/hbgame/setup",
                element: <HbSetupPage />,
              },
              {
                path: "/ghgame",
                element: <GhGamePage />,
              },
              {
                path: "/ghgame/setup",
                element: <GhSetupPage />,
              },
              {
                path: "/ncgame",
                element: <NcGamePage />,
              },
              {
                path: "/ncgame/setup",
                element: <NcSetupPage />,
              },
              {
                path: "/ncgame/patterns",
                element: <NcPatternPage />,
              },
            ],
          },
          ...ProductRouter,
        ],
      },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);

export default router;
