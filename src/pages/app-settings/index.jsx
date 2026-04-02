import { useState, useEffect, useCallback } from "react";
import { useTheme } from "@mui/material/styles";
import { Box, Typography, Switch, FormControlLabel } from "@mui/material";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/auth-store";
import apiCaller from "@/services/api-caller";
import { APP_SETTINGS_API } from "@/constants/api-url";

const GAME_TYPES = [
  { key: "t9", label: "트리플나인" },
  { key: "hb", label: "허니비" },
  { key: "gh", label: "글로벌히트" },
  { key: "nc", label: "나이스초이스" },
];

function AppSettingsPage() {
  const theme = useTheme();
  const currentUser = useAtomValue(userAtom);
  const [blockedGames, setBlockedGames] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await apiCaller.get(APP_SETTINGS_API.BASE);
      setBlockedGames(res.data.config?.blocked_games || []);
    } catch (err) {
      console.error("Failed to fetch app settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const toggleBlockGame = useCallback(async (gameType) => {
    const next = blockedGames.includes(gameType)
      ? blockedGames.filter((g) => g !== gameType)
      : [...blockedGames, gameType];
    try {
      await apiCaller.put(APP_SETTINGS_API.BASE, { config: { blocked_games: next } });
      setBlockedGames(next);
    } catch (err) {
      console.error("Failed to update blocked games:", err);
    }
  }, [blockedGames]);

  if (currentUser?.role !== "admin") {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ color: "#f44336" }}>
          관리자만 접근할 수 있습니다.
        </Typography>
      </Box>
    );
  }

  const isDark = theme.palette.mode === "dark";
  const borderColor = isDark ? "#333" : "#c0c0c0";

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ color: "text.primary", fontWeight: 600, mb: 3 }}>
        앱 설정
      </Typography>

      <Box sx={{ p: 2, border: `1px solid ${borderColor}`, borderRadius: 1, backgroundColor: "background.paper", maxWidth: 500 }}>
        <Typography variant="subtitle1" sx={{ color: "text.primary", fontWeight: 600, mb: 1 }}>
          게임 접근 차단
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
          ON 시 유저 계정의 해당 게임 페이지 접근이 차단됩니다. 어드민은 영향 없음.
        </Typography>
        {loading ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>불러오는 중...</Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {GAME_TYPES.map(({ key, label }) => (
              <FormControlLabel
                key={key}
                control={
                  <Switch
                    checked={blockedGames.includes(key)}
                    onChange={() => toggleBlockGame(key)}
                    sx={{
                      "& .MuiSwitch-switchBase.Mui-checked": { color: "#f44336" },
                      "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#d32f2f" },
                    }}
                  />
                }
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography sx={{ color: "text.primary" }}>{label}</Typography>
                    {blockedGames.includes(key) && (
                      <Typography variant="caption" sx={{ color: "#f44336", fontWeight: 600 }}>차단중</Typography>
                    )}
                  </Box>
                }
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default AppSettingsPage;
