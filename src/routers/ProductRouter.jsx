import ProductList from "@/pages/product";
import ProductDetail from "@/pages/product/ProductDetail";
import ProductLayout from "@pages/product/ProductLayout";

const productRouter = [
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

export default productRouter;
