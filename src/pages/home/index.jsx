import { Box, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/auth-store";

const games = [
  { name: "트리플나인", img: "/triplenine.png", adminPath: "/nc2game/user" },
  { name: "글로벌히트", img: "/globalhit.png", adminPath: "/ghgame/user" },
];

const Home = () => {
  const navigate = useNavigate();
  const user = useAtomValue(userAtom);

  // 일반유저: 로고와 이용 경고문 표시, 클릭 시 글로벌히트로 이동
  if (user?.role !== "admin") {
    return (
      <Box
        onClick={() => navigate("/ghgame/user")}
        sx={{
          width: "100%",
          flex: 1,
          minHeight: 0,
          cursor: "pointer",
          backgroundColor: "#0f1214",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "auto",
          px: { xs: 2, md: 4 },
          py: { xs: 4, md: 6 },
          boxSizing: "border-box",
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 1100, textAlign: "center", color: "#f3f0e7" }}>
          <Box
            component="img"
            src="/header.png"
            alt="TRIPLE NINE"
            sx={{ width: { xs: 240, md: 360 }, maxWidth: "80%", height: "auto", objectFit: "contain", mb: { xs: 4, md: 6 } }}
          />
          <Box role="note" sx={{ fontSize: { xs: 14, md: 18 }, lineHeight: 1.8, fontWeight: 700, wordBreak: "keep-all" }}>
            <Box>해당 프로그램은 연구 목적으로 개발된 프로그램으로서 연구 외 다른 목적으로 사용할 수 없습니다.</Box>
            <Box>대한민국에서는 도박 행위를 엄격히 규제하므로 본 프로그램을 도박 등 불법적인 목적으로 사용하는 것을 금지합니다.</Box>
            <Box>이를 위반하는 행위에 대해서는 관계 법령에 따른 책임이 발생할 수 있음을 알려드립니다.</Box>
            <Box sx={{ mt: 3 }}>
              (도박은 형법 제246조에 따라 1천만원 이하의 벌금, 상습도박은 3년 이하의 징역 또는 2천만원 이하의 벌금에 처할 수 있습니다.)
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: 2, py: 3, px: 2, backgroundColor: "#f4f6f8", minHeight: "100vh" }}>
      {games.map((g) => (
        <Box
          key={g.name}
          onClick={() => navigate(g.adminPath)}
          sx={{
            width: "calc(50% - 8px)",
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexDirection: { xs: "column", sm: "row" },
            borderRadius: 3,
            overflow: "hidden",
            cursor: "pointer",
            border: "none",
            backgroundColor: "#FFFFFF",
            transition: "transform 0.2s, box-shadow 0.2s",
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
            "&:hover": { transform: "translateY(-2px)", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" },
          }}
        >
          <Box sx={{ width: { xs: "100%", sm: 160 }, height: 120, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#2a2a3a" }}>
            <Box component="img" src={g.img} alt={g.name} sx={{ maxHeight: 100, maxWidth: "85%", objectFit: "contain" }} />
          </Box>
          <Typography variant="body1" sx={{ fontWeight: "bold", fontSize: 16, flex: 1, textAlign: "center", color: "#0F172A", py: { xs: 1, sm: 0 } }}>{g.name}</Typography>
        </Box>
      ))}
    </Box>
  );
};

export default Home;
