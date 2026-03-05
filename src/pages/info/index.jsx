// import { useAtomValue, useSetAtom } from "jotai";
// import { sampleAtom, getSampleAtom } from "../../store/SampleStore";
import { useCallback } from "react";
import { Button } from "@mui/material";
import { useNavigate } from "react-router-dom";

const Info = () => {
  // useState

  // use Jotai
  // const sample = useAtomValue(sampleAtom);
  // const getSample = useSetAtom(getSampleAtom);

  // useMemo

  // useCallback
  const navigate = useNavigate();
  const onClickProduct = useCallback(
    (e) => {
      e.preventDefault();

      navigate("/product");
    },
    [navigate],
  );

  // useEffect

  return (
    <div>
      Home
      <br />
      <div>VITE_API_BASE_URL : {import.meta.env.VITE_API_BASE_URL}</div>
      <br />
      <div>MODE : {import.meta.env.MODE}</div>
      <br />
      <Button onClick={onClickProduct} variant="contained">
        go Product
      </Button>
      {/* {sample && sample.message && <div>{sample.message}</div>}
      {(!sample || !sample.message) && <div>Loading...</div>} */}
    </div>
  );
};

export default Info;
