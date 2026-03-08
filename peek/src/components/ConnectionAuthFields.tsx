import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import type { AuthType } from "../hooks/useConnectionForm";

interface ConnectionAuthFieldsProps {
  authType: AuthType;
  onAuthTypeChange: (v: AuthType) => void;
  apiKey: string;
  onApiKeyChange: (v: string) => void;
  username: string;
  onUsernameChange: (v: string) => void;
  password: string;
  onPasswordChange: (v: string) => void;
  showSecret: boolean;
  onToggleShowSecret: () => void;
}

export default function ConnectionAuthFields({
  authType,
  onAuthTypeChange,
  apiKey,
  onApiKeyChange,
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  showSecret,
  onToggleShowSecret,
}: ConnectionAuthFieldsProps) {
  return (
    <>
      <Tabs value={authType} onChange={(_, v: AuthType) => onAuthTypeChange(v)}>
        <Tab label="API Key" value="apiKey" />
        <Tab label="Username / Password" value="userpass" />
        <Tab label="No Auth" value="none" />
      </Tabs>
      {authType === "apiKey" && (
        <TextField
          label="API Key"
          placeholder="base64-encoded API key"
          fullWidth
          type={showSecret ? "text" : "password"}
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          helperText="In browser mode, credentials are stored in session storage and cleared when the tab closes; in Electron, credentials are stored in the OS credential store."
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    aria-label={showSecret ? "Hide credentials" : "Show credentials"}
                    onClick={onToggleShowSecret}
                  >
                    {showSecret ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      )}
      {authType === "userpass" && (
        <>
          <TextField
            label="Username"
            fullWidth
            autoComplete="username"
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
          />
          <TextField
            label="Password"
            fullWidth
            autoComplete="current-password"
            type={showSecret ? "text" : "password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            helperText="In browser mode, credentials are stored in session storage and cleared when the tab closes; in Electron, credentials are stored in the OS credential store."
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      aria-label={showSecret ? "Hide credentials" : "Show credentials"}
                      onClick={onToggleShowSecret}
                    >
                      {showSecret ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </>
      )}
    </>
  );
}
