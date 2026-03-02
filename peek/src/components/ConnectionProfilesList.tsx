import { useState, useCallback } from "react";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import ListItem from "@mui/material/ListItem";
import Divider from "@mui/material/Divider";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import LockIcon from "@mui/icons-material/Lock";

import type { ConnectionProfile } from "../types";

export interface ConnectionProfilesListProps {
  connectionProfiles: ConnectionProfile[];
  activeProfileId: string | null;
  onLoadProfile: (profileId: string) => void;
  onDeleteProfile: (profileId: string) => void;
  onRenameProfile: (id: string, newName: string) => void;
  unlockProfile: (profileId: string, pin: string) => Promise<boolean>;
}

export default function ConnectionProfilesList({
  connectionProfiles,
  activeProfileId,
  onLoadProfile,
  onDeleteProfile,
  onRenameProfile,
  unlockProfile,
}: ConnectionProfilesListProps) {
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [unlockingProfileId, setUnlockingProfileId] = useState<string | null>(null);
  const [unlockPin, setUnlockPin] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockedProfileIds, setUnlockedProfileIds] = useState<Set<string>>(new Set());

  const handleUnlockProfile = useCallback(
    async (profileId: string) => {
      try {
        const ok = await unlockProfile(profileId, unlockPin);
        // Guard against stale async result if user canceled or switched rows
        if (unlockingProfileId !== profileId) return;
        if (ok) {
          setUnlockedProfileIds((prev) => new Set(prev).add(profileId));
          setUnlockingProfileId(null);
          setUnlockPin("");
          setUnlockError(null);
          onLoadProfile(profileId);
        } else {
          setUnlockError("Incorrect PIN");
        }
      } catch {
        if (unlockingProfileId !== profileId) return;
        setUnlockError("Failed to unlock profile");
      }
    },
    [unlockProfile, unlockPin, unlockingProfileId, onLoadProfile],
  );

  const handleRenameProfile = useCallback(
    (id: string) => {
      const trimmed = editingProfileName.trim();
      if (!trimmed) {
        setEditingProfileId(null);
        setEditingProfileName("");
        return;
      }
      onRenameProfile(id, trimmed);
      setEditingProfileId(null);
      setEditingProfileName("");
    },
    [editingProfileName, onRenameProfile],
  );

  if (connectionProfiles.length === 0) return null;

  return (
    <>
      <Typography variant="body2" sx={{ mt: 1 }}>
        Saved Profiles
      </Typography>
      <List dense disablePadding sx={{ borderRadius: 1, bgcolor: "action.hover" }}>
        {connectionProfiles.map((profile) => (
          <ListItem
            key={profile.id}
            disablePadding
            secondaryAction={
              unlockingProfileId !== profile.id ? (
                confirmDeleteId === profile.id ? (
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                      size="small"
                      color="error"
                      variant="contained"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProfile(profile.id);
                        setConfirmDeleteId(null);
                      }}
                    >
                      Confirm Delete
                    </Button>
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </Box>
                ) : (
                  <>
                    <IconButton
                      edge="end"
                      size="small"
                      aria-label={`Rename profile ${profile.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingProfileId(profile.id);
                        setEditingProfileName(profile.name);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      edge="end"
                      size="small"
                      aria-label={`Delete profile ${profile.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(profile.id);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </>
                )
              ) : undefined
            }
          >
            <ListItemButton
              selected={profile.id === activeProfileId}
              onClick={() => {
                if (profile.encrypted && !unlockedProfileIds.has(profile.id)) {
                  if (unlockingProfileId !== profile.id) {
                    setUnlockingProfileId(profile.id);
                    setUnlockPin("");
                    setUnlockError(null);
                  }
                  return;
                }
                onLoadProfile(profile.id);
              }}
              data-testid={`profile-${profile.id}`}
            >
              {editingProfileId === profile.id ? (
                <TextField
                  size="small"
                  aria-label={`Rename profile ${profile.name}`}
                  value={editingProfileName}
                  onChange={(e) => setEditingProfileName(e.target.value)}
                  onBlur={() => handleRenameProfile(profile.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameProfile(profile.id);
                    if (e.key === "Escape") setEditingProfileId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: user just triggered inline rename
                  autoFocus
                  sx={{ mr: 1 }}
                />
              ) : unlockingProfileId === profile.id ? (
                <Box
                  sx={{ display: "flex", flex: 1, gap: 1, alignItems: "flex-start", py: 0.5 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <TextField
                    size="small"
                    type="password"
                    label="Enter PIN"
                    value={unlockPin}
                    onChange={(e) => {
                      setUnlockPin(e.target.value);
                      setUnlockError(null);
                    }}
                    error={!!unlockError}
                    helperText={unlockError ?? undefined}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void handleUnlockProfile(profile.id);
                      }
                      if (e.key === "Escape") {
                        setUnlockingProfileId(null);
                        setUnlockError(null);
                      }
                    }}
                    // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: user just triggered inline PIN entry
                    autoFocus
                    sx={{ flex: 1 }}
                  />
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => void handleUnlockProfile(profile.id)}
                    sx={{ mt: 0.5 }}
                  >
                    Unlock
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setUnlockingProfileId(null);
                      setUnlockError(null);
                    }}
                    sx={{ mt: 0.5 }}
                  >
                    Cancel
                  </Button>
                </Box>
              ) : (
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                      {profile.encrypted && (
                        <LockIcon fontSize="small" color="action" aria-label="Encrypted" />
                      )}
                      {profile.name}
                    </Box>
                  }
                  secondary={profile.connection.url}
                  onDoubleClick={() => {
                    setEditingProfileId(profile.id);
                    setEditingProfileName(profile.name);
                  }}
                />
              )}
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
    </>
  );
}
