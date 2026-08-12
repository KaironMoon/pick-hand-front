export const nc2ItemNumberStyle = (item) => {
  if (item?.end_reason === "max_step_miss") {
    return { backgroundColor: "#c62828", color: "#fff", fontWeight: 900 };
  }
  if (item?.ended) {
    return { backgroundColor: "#1565c0", color: "#fff", fontWeight: 900 };
  }
  return { backgroundColor: "#181d23", color: "#fff", fontWeight: 400 };
};
