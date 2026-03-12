import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import Home from "../pages/home";
import Info from "../pages/info";
import GamePage from "../pages/t9game";
import PatternPage from "../pages/t9game/pattern.jsx";
import SetupPage from "../pages/t9game/setup.jsx";
import NotFound from "../pages/error/NotFound";
import PageLayout from "../pages/PageLayout";
import LoginPage from "../pages/login";
import UsersPage from "../pages/users";
import ProtectedRoute from "../pages/components/ProtectedRoute";

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
            element: <GamePage />,
          },
          {
            path: "/home",
            element: <Home />,
          },
          {
            path: "/t9game",
            element: <GamePage />,
          },
          {
            path: "/info",
            element: <Info />,
          },
          {
            path: "/patterns",
            element: <PatternPage />,
          },
          {
            path: "/t9game/setup",
            element: <SetupPage />,
          },
          {
            path: "/users",
            element: <UsersPage />,
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
