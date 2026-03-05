import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";

function ProductLayout() {
  return (
    <Box>
      <div>Product Layout</div>
      <br />
      <Outlet />
    </Box>
  );
}

export default ProductLayout;
