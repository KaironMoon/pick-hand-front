import { styled, TableCell, tableCellClasses } from "@mui/material";

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  backgroundColor: theme.palette.common.black,
  color: theme.palette.common.white,
  [`&.${tableCellClasses.body}`]: {
    fontSize: 12,
  },
}));

export default StyledTableCell;
