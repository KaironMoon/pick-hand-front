import { Link, TextField } from "@mui/material";

export default function TelegramRecipientField({ value, onChange, connected = false, disabled, sx }) {
  return <TextField fullWidth label="텔레그램 @아이디" placeholder="@my_username"
    value={value} onChange={onChange} disabled={disabled} margin="dense" sx={sx}
    autoComplete="off"
    helperText={<>
      본인 @아이디를 저장한 뒤 <Link href="https://t.me/pick_hand_bot" target="_blank" rel="noopener noreferrer">픽미알림봇(@pick_hand_bot)</Link>에서 시작 또는 /start를 보내세요.
      숫자는 입력하지 않습니다. 빈 값으로 저장하면 알림이 해제됩니다.<br />
      현재 저장된 연결 상태: {connected ? "연결됨" : "연결 전"}.
    </>} />;
}
