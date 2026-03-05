import { styled, TableSortLabel, tableCellClasses } from "@mui/material";

const StyledTableSortLabel = styled(TableSortLabel)(({ theme }) => ({
  backgroundColor: theme.palette.common.black,
  color: theme.palette.common.white,
  [`&.${tableCellClasses.body}`]: {
    fontSize: 12,
  },
  "&.Mui-active": {
    color: theme.palette.common.white,
  },
  ":hover": {
    color: theme.palette.common.white,
  },
  "&.Mui-active .MuiTableSortLabel-icon": {
    color: theme.palette.common.white,
  },
}));

export default StyledTableSortLabel;
