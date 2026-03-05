import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import Home from "../pages/home";
import Info from "../pages/info";
import NotFound from "../pages/error/NotFound";
import PageLayout from "../pages/PageLayout";

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
    path: "/",
    element: <PageLayout />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/home",
        element: <Home />,
      },
      {
        path: "/info",
        element: <Info />,
      },
      ...ProductRouter,
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);

export default router;
