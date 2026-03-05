import { useState } from "react";

function useProductList() {
  const [product, setProduct] = useState(null);

  return { product, setProduct };
}

export default useProductList;
