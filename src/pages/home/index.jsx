import { Box, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/auth-store";

const games = [
  { name: "트리플나인", img: "/triplenine.png", adminPath: "/t9game", userPath: "/t9game/user" },
  { name: "허니비", img: "/honeybee.png", adminPath: "/hbgame", userPath: "/hbgame/user" },
  { name: "글로벌히트", img: "/globalhit.png", adminPath: "/ghgame", userPath: "/ghgame/user" },
];

const Home = () => {
  const navigate = useNavigate();
  const user = useAtomValue(userAtom);

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: 2, py: 3, px: 2, backgroundColor: "#d0d0d6", minHeight: "100vh" }}>
      {games.map((g) => (
        <Box
          key={g.name}
          onClick={() => navigate(user?.role === "admin" ? `${g.adminPath}?new=${Date.now()}` : `${g.userPath}?new=${Date.now()}`)}
          sx={{
            width: "calc(50% - 8px)",
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexDirection: { xs: "column", sm: "row" },
            borderRadius: 3,
            overflow: "hidden",
            cursor: "pointer",
            border: "1px solid #ccc",
            backgroundColor: "#fff",
            transition: "transform 0.2s, box-shadow 0.2s",
            "&:hover": { transform: "translateY(-2px)", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" },
          }}
        >
          <Box sx={{ width: { xs: "100%", sm: 160 }, height: 120, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f0e8c0" }}>
            <Box component="img" src={g.img} alt={g.name} sx={{ maxHeight: 100, maxWidth: "85%", objectFit: "contain" }} />
          </Box>
          <Typography variant="body1" sx={{ fontWeight: "bold", fontSize: 16, flex: 1, textAlign: "center", color: "#333" }}>{g.name}</Typography>
        </Box>
      ))}
    </Box>
  );
};

export default Home;
