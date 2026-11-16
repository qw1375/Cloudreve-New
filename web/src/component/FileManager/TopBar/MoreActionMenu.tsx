import {
  Divider,
  ListItemIcon,
  ListItemText,
  MenuProps,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useCallback, useContext, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import { updateFilePolicy } from "../../../api/api.ts";
import { NavigatorCapability } from "../../../api/explorer.ts";
import { clearSelected } from "../../../redux/fileManagerSlice.ts";
import { setReportAbuseDialog } from "../../../redux/globalStateSlice.ts";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks.ts";
import { createShareShortcut, isMacbook } from "../../../redux/thunks/file.ts";
import {
  inverseSelection,
  loadPolicyOptions,
  pinCurrentView,
  refreshFileList,
  selectAll,
} from "../../../redux/thunks/filemanager.ts";
import { queueLoadShareInfo } from "../../../redux/thunks/share.ts";
import SessionManager from "../../../session";
import Boolset from "../../../util/boolset.ts";
import CrUri, { Filesystem } from "../../../util/uri.ts";
import { DefaultCloseAction } from "../../Common/Snackbar/snackbar.tsx";
import { KeyIndicator } from "../../Frame/NavBar/SearchBar.tsx";
import ArrowSync from "../../Icons/ArrowSync.tsx";
import Border from "../../Icons/Border.tsx";
import BorderAll from "../../Icons/BorderAll.tsx";
import BorderInside from "../../Icons/BorderInside.tsx";
import Checkmark from "../../Icons/Checkmark.tsx";
import FolderLink from "../../Icons/FolderLink.tsx";
import PinOutlined from "../../Icons/PinOutlined.tsx";
import StorageOutlined from "../../Icons/StorageOutlined.tsx";
import WarningOutlined from "../../Icons/WarningOutlined.tsx";
import { CascadingSubmenu } from "../ContextMenu/CascadingMenu.tsx";
import { DenseDivider, SquareMenu, SquareMenuItem } from "../ContextMenu/ContextMenu.tsx";
import { FileManagerIndex } from "../FileManager.tsx";
import { FmIndexContext } from "../FmIndexContext.tsx";

const MoreActionMenu = ({ onClose, ...rest }: MenuProps) => {
  const { t } = useTranslation();
  const fmIndex = useContext(FmIndexContext);
  const fs = useAppSelector((state) => state.fileManager[fmIndex].current_fs);
  const purePath = useAppSelector((state) => state.fileManager[fmIndex].pure_path);
  const dispatch = useAppDispatch();
  const isLogin = !!SessionManager.currentLoginOrNull();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { enqueueSnackbar } = useSnackbar();
  const list = useAppSelector((state) => state.fileManager[fmIndex].list);
  const policyOptions = useAppSelector((state) => state.globalState.policyOptionCache);
  const canMount = useMemo(() => {
    if (!list?.props?.capability || list.single_file_view) {
      return false;
    }
    return new Boolset(list.props.capability).enabled(NavigatorCapability.mount);
  }, [list?.props?.capability, list?.single_file_view]);
  const isOwner = !!list?.parent?.owned;
  const currentPolicyID = list?.storage_policy?.id;

  useEffect(() => {
    if (isMobile && isLogin && !policyOptions) {
      dispatch(loadPolicyOptions()).catch(() => undefined);
    }
  }, [dispatch, isLogin, isMobile, policyOptions]);

  const onPinClicked = useCallback(() => {
    dispatch(pinCurrentView(fmIndex));
    onClose && onClose({}, "escapeKeyDown");
  }, [dispatch, onClose, fmIndex]);

  const onCreateShortcutClicked = useCallback(() => {
    dispatch(createShareShortcut(fmIndex));
    onClose && onClose({}, "escapeKeyDown");
  }, [dispatch, onClose, fmIndex]);

  const onSelectAllClicked = useCallback(() => {
    onClose && onClose({}, "escapeKeyDown");
    dispatch(selectAll(fmIndex));
  }, [dispatch, onClose, fmIndex]);

  const onSelectNoneClicked = useCallback(() => {
    onClose && onClose({}, "escapeKeyDown");
    dispatch(clearSelected({ index: fmIndex, value: undefined }));
  }, [dispatch, onClose, fmIndex]);

  const onInverseSelectionClicked = useCallback(() => {
    onClose && onClose({}, "escapeKeyDown");
    dispatch(inverseSelection(fmIndex));
  }, [dispatch, onClose, fmIndex]);

  const onRefreshClicked = useCallback(() => {
    onClose && onClose({}, "escapeKeyDown");
    dispatch(refreshFileList(fmIndex));
  }, [dispatch, onClose, fmIndex]);

  const onReportClicked = useCallback(() => {
    onClose && onClose({}, "escapeKeyDown");
    if (!purePath) {
      return;
    }
    dispatch(queueLoadShareInfo(new CrUri(purePath))).then((share) => {
      dispatch(setReportAbuseDialog({ open: true, share }));
    });
  }, [dispatch, onClose, purePath]);

  const onMountClicked = useCallback(
    (policy: { id: string; name: string }) => {
      if (!purePath || policy.id === currentPolicyID) {
        return;
      }
      dispatch(updateFilePolicy({ uri: purePath, policy_id: policy.id }))
        .then(() => {
          enqueueSnackbar({
            message: t("application:vas.folderPolicySwitched", { name: policy.name }),
            variant: "success",
            action: DefaultCloseAction,
          });
          dispatch(refreshFileList(fmIndex));
          onClose && onClose({}, "escapeKeyDown");
        })
        .catch(() => undefined);
    },
    [currentPolicyID, dispatch, enqueueSnackbar, fmIndex, onClose, purePath, t],
  );

  return (
    <SquareMenu
      MenuListProps={{
        dense: true,
      }}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "right",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      onClose={onClose}
      {...rest}
    >
      {isMobile && (
        <>
          <SquareMenuItem onClick={onRefreshClicked}>
            <ListItemIcon>
              <ArrowSync fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t("application:fileManager.refresh")}</ListItemText>
          </SquareMenuItem>
          {fmIndex == FileManagerIndex.main && (
            <CascadingSubmenu
              title={t("application:vas.switchFolderPolicy")}
              popupId="mountPolicy"
              icon={<StorageOutlined fontSize="small" />}
            >
              {!canMount && (
                <SquareMenuItem disabled>
                  <ListItemIcon>
                    <WarningOutlined fontSize="small" />
                  </ListItemIcon>
                  <Typography variant="body2" color="text.secondary">
                    {t("application:fileManager.noActionsCanBeDone")}
                  </Typography>
                </SquareMenuItem>
              )}
              {canMount && !isOwner && (
                <SquareMenuItem disabled>
                  <Stack sx={{ px: 1, py: 0.5 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {t("application:uploader.storagePolicy")}
                    </Typography>
                    <Typography variant="body2">{list?.storage_policy?.name ?? "-"}</Typography>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography variant="body2" color="text.secondary">
                      {t("application:fileManager.mountOwner")}
                    </Typography>
                  </Stack>
                </SquareMenuItem>
              )}
              {canMount &&
                isOwner &&
                (policyOptions ?? []).map((policy) => (
                  <SquareMenuItem key={policy.id} onClick={() => onMountClicked(policy)}>
                    {policy.id === currentPolicyID && (
                      <ListItemIcon>
                        <Checkmark fontSize="small" />
                      </ListItemIcon>
                    )}
                    <ListItemText inset={policy.id !== currentPolicyID}>
                      <Typography variant="body2" sx={{ whiteSpace: "normal" }}>
                        {policy.name}
                      </Typography>
                    </ListItemText>
                  </SquareMenuItem>
                ))}
              {canMount && isOwner && (!policyOptions || policyOptions.length === 0) && (
                <>
                  <SquareMenuItem disabled>
                    <ListItemText inset>
                      <Skeleton variant="text" width={100} />
                    </ListItemText>
                  </SquareMenuItem>
                  <SquareMenuItem disabled>
                    <ListItemText inset>
                      <Skeleton variant="text" width={100} />
                    </ListItemText>
                  </SquareMenuItem>
                </>
              )}
            </CascadingSubmenu>
          )}
          <DenseDivider />
        </>
      )}
      {isLogin && (
        <SquareMenuItem onClick={onPinClicked}>
          <ListItemIcon>
            <PinOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("application:fileManager.pin")}</ListItemText>
        </SquareMenuItem>
      )}
      {isLogin && fs == Filesystem.share && (
        <>
          <SquareMenuItem onClick={onCreateShortcutClicked}>
            <ListItemIcon>
              <FolderLink fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t("application:fileManager.saveShortcut")}</ListItemText>
          </SquareMenuItem>
        </>
      )}
      {fs == Filesystem.share && (
        <SquareMenuItem onClick={onReportClicked}>
          <ListItemIcon>
            <WarningOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("application:vas.report")}</ListItemText>
        </SquareMenuItem>
      )}
      {(isLogin || fs == Filesystem.share) && <DenseDivider />}
      <SquareMenuItem onClick={onSelectAllClicked}>
        <ListItemIcon>
          <BorderAll fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("application:fileManager.selectAll")}</ListItemText>
        <Typography variant="body2" color="text.secondary">
          <KeyIndicator>{isMacbook ? "⌘" : "Ctrl"}</KeyIndicator>+<KeyIndicator>A</KeyIndicator>
        </Typography>
      </SquareMenuItem>
      <SquareMenuItem onClick={onSelectNoneClicked}>
        <ListItemIcon>
          <Border fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("application:fileManager.selectNone")}</ListItemText>
      </SquareMenuItem>
      <SquareMenuItem onClick={onInverseSelectionClicked}>
        <ListItemIcon>
          <BorderInside fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("application:fileManager.invertSelection")}</ListItemText>
      </SquareMenuItem>
    </SquareMenu>
  );
};

export default MoreActionMenu;
