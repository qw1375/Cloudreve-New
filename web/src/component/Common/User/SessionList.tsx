import {
  Avatar,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SessionManager, { Session } from "../../../session/index.ts";
import { SquareChip } from "../StyledComponents.tsx";
import Add from "../../Icons/Add.tsx";
import Delete from "../../Icons/Delete.tsx";
import UserAvatar from "./UserAvatar.tsx";

export interface SessionListProps {
  current?: { id: string };
  variant?: "list";
  switchSession: (session: Session) => void;
  loginWithHint: (email: string) => void;
  onAllSessionRemoved: () => void;
  onLoginWithOtherAccount: () => void;
}

const SessionList = ({
  current,
  variant,
  switchSession,
  loginWithHint,
  onAllSessionRemoved,
  onLoginWithOtherAccount,
}: SessionListProps) => {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<Session[]>(SessionManager.validSession());

  useEffect(() => {
    setSessions(SessionManager.validSession());
  }, []);

  const remove = useCallback(
    (session: Session) => {
      SessionManager.removeSession(session.user.id);
      const rest = SessionManager.validSession();
      setSessions(rest);
      if (rest.length === 0) {
        onAllSessionRemoved();
      }
    },
    [onAllSessionRemoved],
  );

  const compact = variant == "list";
  const avatarSize = compact ? 46 : 56;
  const visible = sessions.filter((session) => (current ? session.user.id != current.id : true));

  return (
    <List sx={{ width: "100%" }} dense={compact}>
      {visible.map((session) => (
        <ListItem
          key={session.user.id}
          disablePadding
          secondaryAction={
            <Tooltip title={t("login.logout")}>
              <IconButton
                edge="end"
                size={compact ? "small" : undefined}
                aria-label="delete"
                onClick={() => remove(session)}
              >
                <Delete fontSize={compact ? "small" : undefined} />
              </IconButton>
            </Tooltip>
          }
        >
          <ListItemButton
            sx={{ pr: 7 }}
            onClick={() => (session.signedOut ? loginWithHint(session.user.email ?? "") : switchSession(session))}
          >
            <ListItemAvatar sx={{ minWidth: avatarSize }}>
              <UserAvatar sx={compact ? { width: 30, height: 30 } : undefined} user={session.user} />
            </ListItemAvatar>
            <ListItemText
              sx={compact ? { my: 0 } : undefined}
              primary={
                <Typography variant={compact ? "body2" : "body1"} component="span">
                  {session.user.nickname}
                  {session.signedOut && (
                    <SquareChip
                      size="small"
                      sx={{ ml: 1, height: "initial", fontSize: compact ? "0.65rem" : undefined }}
                      label={t("navbar.notLoginIn")}
                    />
                  )}
                </Typography>
              }
              secondary={session.user.email}
              slotProps={{
                secondary: { sx: { wordBreak: "break-all" }, variant: compact ? "caption" : "body2" },
              }}
            />
          </ListItemButton>
        </ListItem>
      ))}
      <ListItem disablePadding>
        <ListItemButton onClick={onLoginWithOtherAccount}>
          <ListItemAvatar sx={{ minWidth: avatarSize }}>
            <Avatar
              sx={(theme) => ({
                bgcolor: theme.palette.action.active,
                ...(compact ? { width: 30, height: 30 } : {}),
              })}
            >
              <Add fontSize={compact ? "small" : undefined} />
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            sx={compact ? { my: 1 } : undefined}
            primary={t("login.useOtherAccount")}
            slotProps={{ primary: { variant: compact ? "body2" : undefined } }}
          />
        </ListItemButton>
      </ListItem>
    </List>
  );
};

export default SessionList;
