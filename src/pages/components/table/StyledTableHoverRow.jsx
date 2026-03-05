import { styled, TableRow } from "@mui/material";

const StyledTableHoverRow = styled(TableRow)(({ theme }) => ({
  "&:hover": {
    cursor: "pointer",
    backgroundColor: theme.palette.grey[100],
  },
}));

export default StyledTableHoverRow;
