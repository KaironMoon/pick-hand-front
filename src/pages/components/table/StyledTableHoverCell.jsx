import { styled, TableCell, tableCellClasses } from "@mui/material";

const StyledTableHoverCell = styled(TableCell)(({ theme }) => ({
  backgroundColor: theme.palette.common.black,
  color: theme.palette.common.white,
  "&:hover": {
    backgroundColor: theme.palette.grey[800],
    color: theme.palette.common.white,
  },
  [`&.${tableCellClasses.body}`]: {
    fontSize: 12,
  },
}));

export default StyledTableHoverCell;
