import { Add, Delete as DeleteIcon, ExpandMoreRounded } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputAdornment,
  Link,
  Menu,
  MenuItem,
  styled,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import MuiAccordionSummary, { AccordionSummaryProps } from "@mui/material/AccordionSummary";
import { bindMenu, bindTrigger, usePopupState } from "material-ui-popup-state/hooks";
import { useContext, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { defaultOpts, send } from "../../../../api/request";
import { useAppDispatch } from "../../../../redux/hooks";
import { DenseFilledTextField, SecondaryButton } from "../../../Common/StyledComponents";
import GroupSelectionInput from "../../Common/GroupSelectionInput";
import { SettingContext } from "../SettingWrapper";

const NoMarginHelperText = styled(FormHelperText)(() => ({
  marginLeft: 0,
  marginRight: 0,
}));

export const AccordionSummary = styled((props: AccordionSummaryProps) => <MuiAccordionSummary {...props} />)(
  ({ theme }) => ({
    fontSize: theme.typography.body2.fontSize,
    paddingLeft: theme.spacing(4),
    "& .MuiFormControlLabel-label": {
      fontSize: theme.typography.body2.fontSize,
    },
    "& .MuiCheckbox-root": {
      marginRight: theme.spacing(2),
    },
  }),
);

export const StyledAccordion = styled(Accordion)(({ theme }) => ({
  boxShadow: "none",
  border: `1px solid ${theme.palette.divider}`,
  "&::before": {
    display: "none",
  },
}));

type ProviderType = "oidc" | "logto" | "qq";

interface ProviderConfig {
  direct_sign_in?: boolean;
  display_name?: string;
  icon?: string;
  scope?: string;
  client_id?: string;
  client_secret?: string;
  app_id?: string;
  app_secret?: string;
  endpoint?: string;
  direct_sso?: string;
  sub_field_mapping?: string;
  email_field_mapping?: string;
  avatar_field_mapping?: string;
  name_field_mapping?: string;
  group_field_mapping?: string;
  group_mapping?: Record<string, number>;
  [key: string]: unknown;
}

interface LoginProvider {
  id: number;
  type: ProviderType;
  enabled: boolean;
  config: ProviderConfig;
  wellknown?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ProvidersSetting {
  version: number;
  next_id: number;
  providers: LoginProvider[];
  [key: string]: unknown;
}

const emptyProviders = (): ProvidersSetting => ({
  version: 1,
  next_id: 3,
  providers: [],
});

const defaultProviderConfig = (type: ProviderType): ProviderConfig => ({
  ...(type === "qq"
    ? {
        direct_sign_in: false,
        display_name: "vas.qq",
        icon: "ri:qq-fill",
      }
    : type === "logto"
      ? {
          direct_sign_in: true,
          display_name: "vas.sso",
        }
      : {
          direct_sign_in: true,
          display_name: "vas.sso",
          scope: "email",
        }),
});

const providerCallbackURL = (provider: LoginProvider): string => {
  const base = window.location.origin.replace(/\/$/, "");
  const path = provider.type === "qq" && provider.id === 1 ? "login/qq" : `callback/openid/${provider.id}`;
  return `${base}/${path}`;
};

const parseProviders = (raw?: string): ProvidersSetting => {
  if (!raw) {
    return emptyProviders();
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return emptyProviders();
    }
    return {
      ...parsed,
      version: typeof parsed.version === "number" ? parsed.version : 1,
      next_id: Math.max(typeof parsed.next_id === "number" ? parsed.next_id : 3, 3),
      providers: Array.isArray(parsed.providers)
        ? parsed.providers.map((provider: LoginProvider) => ({
            ...provider,
            config: provider?.config && typeof provider.config === "object" ? provider.config : {},
          }))
        : [],
    };
  } catch {
    return emptyProviders();
  }
};

const parseObject = (raw: string, fallback: Record<string, unknown> = {}): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const parseObjectOrUndefined = (raw: string): Record<string, unknown> | undefined => {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const parseGroupMapping = (raw: unknown): [string, string][] => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }
  return Object.entries(raw as Record<string, unknown>).map(([key, value]) => [key, String(value ?? "")]);
};

const providerTypeName = (type: ProviderType) => {
  switch (type) {
    case "oidc":
      return "OpenID Connect";
    case "logto":
      return "Logto";
    case "qq":
      return "QQ";
  }
};

const providerTypeLabel = (type: ProviderType, t: (key: string) => string) => {
  switch (type) {
    case "qq":
      return t("vas.qqConnect");
    case "logto":
      return t("settings.logto");
    case "oidc":
      return t("settings.oidc");
  }
};

const fieldMappings: {
  key: keyof ProviderConfig;
  labelKey: string;
  placeholder: string;
}[] = [
  { key: "sub_field_mapping", labelKey: "settings.oidcSubField", placeholder: "sub" },
  { key: "email_field_mapping", labelKey: "settings.oidcEmailField", placeholder: "email" },
  { key: "avatar_field_mapping", labelKey: "settings.oidcAvatarField", placeholder: "picture" },
  { key: "name_field_mapping", labelKey: "settings.oidcNameField", placeholder: "name" },
];

const SSOSettings = () => {
  const { t } = useTranslation("dashboard");
  const { values, setSettings } = useContext(SettingContext);
  const dispatch = useAppDispatch();
  const rawProviders = values.external_login_providers;
  const [providers, setProviders] = useState<ProvidersSetting>(() => parseProviders(rawProviders));
  const [wellknownDraft, setWellknownDraft] = useState<Record<number, string>>({});
  const [groupMappingDraft, setGroupMappingDraft] = useState<Record<number, [string, string][]>>({});
  const [importUrls, setImportUrls] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState<Record<number, boolean>>({});
  const [wellknownImportOpen, setWellknownImportOpen] = useState<number | undefined>();
  const [hydrated, setHydrated] = useState(false);
  const syncedProviders = useRef<string | undefined>();
  const migrationAttempted = useRef(false);
  const addProviderPopup = usePopupState({
    variant: "popover",
    popupId: "externalLoginProviderSelector",
  });
  const { onClose: closeAddProviderPopup, ...addProviderMenuProps } = bindMenu(addProviderPopup);

  useEffect(() => {
    const parsed = parseProviders(rawProviders);
    const externalChange = syncedProviders.current !== rawProviders;
    const shouldMigrateLegacy =
      !migrationAttempted.current && parsed.providers.length === 0 && !!values.oidc_client_id;
    migrationAttempted.current = true;
    if (shouldMigrateLegacy) {
      const groupMapping: Record<string, number> = {};
      try {
        const legacyMapping = JSON.parse(values.oidc_group_mapping || "{}");
        if (legacyMapping && typeof legacyMapping === "object") {
          Object.entries(legacyMapping).forEach(([key, value]) => {
            const groupID = parseInt(String(value));
            if (!Number.isNaN(groupID)) {
              groupMapping[key] = groupID;
            }
          });
        }
      } catch {
        // Keep an empty mapping when the legacy value is invalid.
      }
      let legacyWellknown: Record<string, unknown> = {};
      if (values.oidc_wellknown) {
        legacyWellknown = parseObject(values.oidc_wellknown);
        if (Object.keys(legacyWellknown).length === 0) {
          legacyWellknown = { issuer: values.oidc_wellknown };
        }
      } else if (values.oidc_issuer) {
        legacyWellknown = { issuer: values.oidc_issuer };
      }
      const migrated: ProvidersSetting = {
        version: 1,
        next_id: 4,
        providers: [
          {
            id: 3,
            type: "oidc",
            enabled: values.oidc_enabled === "1" || values.oidc_enabled === "true",
            config: {
              direct_sign_in: values.oidc_direct_sso !== "0",
              display_name: values.oidc_name || "SSO",
              scope: values.oidc_scopes || "email",
              client_id: values.oidc_client_id || "",
              client_secret: values.oidc_client_secret || "",
              sub_field_mapping: "sub",
              email_field_mapping: "email",
              avatar_field_mapping: "picture",
              name_field_mapping: "name",
              group_field_mapping: values.oidc_group_field || "",
              group_mapping: groupMapping,
            },
            wellknown: legacyWellknown,
          },
        ],
      };
      setProviders(migrated);
      setWellknownDraft({});
      setGroupMappingDraft({});
      syncedProviders.current = JSON.stringify(migrated);
      setSettings({ external_login_providers: JSON.stringify(migrated) });
    } else {
      setProviders(parsed);
      if (externalChange) {
        setWellknownDraft({});
        setGroupMappingDraft({});
      }
      syncedProviders.current = rawProviders;
    }
    setHydrated(true);
  }, [
    rawProviders,
    values.oidc_client_id,
    values.oidc_enabled,
    values.oidc_name,
    values.oidc_client_secret,
    values.oidc_scopes,
    values.oidc_direct_sso,
    values.oidc_issuer,
    values.oidc_wellknown,
    values.oidc_group_field,
    values.oidc_group_mapping,
  ]);

  const persist = (next: ProvidersSetting) => {
    syncedProviders.current = JSON.stringify(next);
    setProviders(next);
    setSettings({ external_login_providers: JSON.stringify(next) });
  };

  const updateProvider = (id: number, updater: (provider: LoginProvider) => LoginProvider) => {
    persist({
      ...providers,
      providers: providers.providers.map((provider) => (provider.id === id ? updater(provider) : provider)),
    });
  };

  const updateConfig = (id: number, patch: Partial<ProviderConfig>) => {
    updateProvider(id, (provider) => ({
      ...provider,
      config: {
        ...provider.config,
        ...patch,
      },
    }));
  };

  const addProvider = (type: ProviderType) => {
    const id = providers.next_id;
    const provider: LoginProvider = {
      id,
      type,
      enabled: false,
      config: defaultProviderConfig(type),
      ...(type === "oidc" ? { wellknown: {} } : {}),
    };
    persist({
      ...providers,
      next_id: id + 1,
      providers: [...providers.providers, provider],
    });
    closeAddProviderPopup();
  };

  const removeProvider = (id: number) => {
    persist({
      ...providers,
      providers: providers.providers.filter((provider) => provider.id !== id),
    });
    setWellknownImportOpen((current) => (current === id ? undefined : current));
  };

  const updateWellknown = (provider: LoginProvider, raw: string) => {
    setWellknownDraft((current) => ({ ...current, [provider.id]: raw }));
    const parsed = parseObjectOrUndefined(raw);
    if (parsed !== undefined) {
      updateProvider(provider.id, (item) => ({ ...item, wellknown: parsed }));
    }
  };

  const importWellknown = (provider: LoginProvider) => {
    const url = (importUrls[provider.id] ?? "").trim();
    if (!url) {
      return;
    }
    setImporting((current) => ({ ...current, [provider.id]: true }));
    dispatch(
      send<unknown>(
        "/admin/tool/oidc",
        {
          method: "GET",
          params: { endpoint: url },
        },
        { ...defaultOpts, bypassSnackbar: () => true },
      ),
    )
      .then((wellknown) => {
        const payload = (typeof wellknown === "string" ? JSON.parse(wellknown) : wellknown) as Record<
          string,
          unknown
        >;
        if (!payload || typeof payload !== "object") {
          return;
        }
        const raw = JSON.stringify(payload, null, 2);
        setWellknownDraft((current) => ({ ...current, [provider.id]: raw }));
        updateProvider(provider.id, (item) => ({ ...item, wellknown: payload }));
        setWellknownImportOpen(undefined);
      })
      .catch(() => {
        try {
          const parsedUrl = new URL(url);
          const issuer = parsedUrl.pathname.endsWith("/.well-known/openid-configuration")
            ? parsedUrl.origin + parsedUrl.pathname.slice(0, -"/.well-known/openid-configuration".length)
            : parsedUrl.origin;
          setWellknownDraft((current) => ({
            ...current,
            [provider.id]: JSON.stringify({ issuer, well_known: url }, null, 2),
          }));
          updateProvider(provider.id, (item) => ({
            ...item,
            wellknown: { issuer, well_known: url },
          }));
          setWellknownImportOpen(undefined);
        } catch {
          // The request layer already reports a useful error for invalid input.
        }
      })
      .finally(() => {
        setImporting((current) => ({ ...current, [provider.id]: false }));
      });
  };

  const providerLabel = (provider: LoginProvider) =>
    provider.config.display_name || providerTypeName(provider.type);

  const updateGroupMapping = (provider: LoginProvider, entries: [string, string][]) => {
    setGroupMappingDraft((current) => ({ ...current, [provider.id]: entries }));
    const mapping: Record<string, number> = {};
    entries.forEach(([key, group]) => {
      const groupID = parseInt(group);
      if (key.trim() && !Number.isNaN(groupID)) {
        mapping[key.trim()] = groupID;
      }
    });
    updateConfig(provider.id, { group_mapping: Object.keys(mapping).length ? mapping : undefined });
  };

  const getGroupMappingEntries = (provider: LoginProvider) =>
    groupMappingDraft[provider.id] ?? parseGroupMapping(provider.config.group_mapping);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {hydrated && providers.providers.length === 0 && (
        <Typography variant="body2" color="text.secondary" />
      )}
      {providers.providers.map((provider) => (
        <StyledAccordion
          key={provider.id}
          disableGutters
          defaultExpanded={provider.enabled}
          TransitionProps={{ unmountOnExit: true }}
        >
          <AccordionSummary expandIcon={<ExpandMoreRounded />}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                gap: 1,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {providerLabel(provider)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {providerTypeLabel(provider.type, t)} · #{provider.id}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Switch
                  size="small"
                  checked={provider.enabled}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  onChange={(_, checked) => updateProvider(provider.id, (item) => ({ ...item, enabled: checked }))}
                />
                <IconButton
                  size="small"
                  aria-label="Delete provider"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeProvider(provider.id);
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {provider.type === "qq" ? (
              <Alert severity="info">
                <Trans
                  i18nKey="vas.qqConnectHint"
                  ns="dashboard"
                  values={{ url: providerCallbackURL(provider) }}
                  components={[
                    <Link href="https://connect.qq.com/" target="_blank" />,
                  ]}
                />
              </Alert>
            ) : provider.type === "logto" ? (
              <Alert severity="info">
                <Trans
                  i18nKey="settings.logtoDes"
                  ns="dashboard"
                  values={{ url: providerCallbackURL(provider) }}
                  components={[
                    <Link href="https://logto.io/" target="_blank" />,
                    <code />,
                  ]}
                />
              </Alert>
            ) : (
              <Alert severity="info">
                <Trans
                  i18nKey="settings.oidcDes"
                  ns="dashboard"
                  values={{ url: providerCallbackURL(provider) }}
                  components={[
                    <code />,
                    <Link href="https://docs.cloudreve.org/usage/oidc" target="_blank" />,
                  ]}
                />
              </Alert>
            )}
            <FormControl fullWidth>
              <Typography variant="body2">{t("settings.logtoName")}</Typography>
              <DenseFilledTextField
                value={String(provider.config.display_name ?? "")}
                onChange={(e) => updateConfig(provider.id, { display_name: e.target.value })}
                placeholder="SSO"
                required={provider.enabled}
              />
              <NoMarginHelperText>{t("settings.logtoNameDes")}</NoMarginHelperText>
            </FormControl>
            <FormControl fullWidth>
              <Typography variant="body2">{t("settings.icon")}</Typography>
              <DenseFilledTextField
                value={String(provider.config.icon ?? "")}
                onChange={(e) => updateConfig(provider.id, { icon: e.target.value || undefined })}
                placeholder="mdi:openid"
              />
              <NoMarginHelperText>
                <Trans
                  i18nKey="settings.ssoIconDes"
                  ns="dashboard"
                  components={[<Link href="https://icon-sets.iconify.design/" target="_blank" />]}
                />
              </NoMarginHelperText>
            </FormControl>
            <FormControl fullWidth>
              <Typography variant="body2">
                {provider.type === "oidc" ? t("settings.clientID") : t("vas.appid")}
              </Typography>
              <DenseFilledTextField
                value={String(
                  provider.type === "oidc" ? (provider.config.client_id ?? "") : (provider.config.app_id ?? ""),
                )}
                required={provider.enabled}
                onChange={(e) =>
                  updateConfig(
                    provider.id,
                    provider.type === "oidc" ? { client_id: e.target.value } : { app_id: e.target.value },
                  )
                }
              />
              <NoMarginHelperText>
                {provider.type === "oidc" ? t("settings.clientIDDes") : t("vas.appidDes")}
              </NoMarginHelperText>
            </FormControl>
            <FormControl fullWidth>
              <Typography variant="body2">
                {provider.type === "oidc" ? t("settings.clientSecret") : t("vas.appKey")}
              </Typography>
              <DenseFilledTextField
                type="password"
                value={String(
                  provider.type === "oidc"
                    ? (provider.config.client_secret ?? "")
                    : (provider.config.app_secret ?? ""),
                )}
                required={provider.enabled}
                onChange={(e) =>
                  updateConfig(
                    provider.id,
                    provider.type === "oidc" ? { client_secret: e.target.value } : { app_secret: e.target.value },
                  )
                }
              />
              <NoMarginHelperText>
                {provider.type === "oidc" ? t("settings.clientSecretDes") : t("vas.appKeyDes")}
              </NoMarginHelperText>
            </FormControl>
            {provider.type === "oidc" && (
              <FormControl fullWidth>
                <Typography variant="body2">{t("settings.scope")}</Typography>
                <DenseFilledTextField
                  value={String(provider.config.scope ?? "")}
                  onChange={(e) => updateConfig(provider.id, { scope: e.target.value })}
                  placeholder="openid email profile"
                />
                <NoMarginHelperText>{t("settings.scopeDes")}</NoMarginHelperText>
              </FormControl>
            )}
            <FormControl>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={!!provider.config.direct_sign_in}
                    onChange={(_, checked) => updateConfig(provider.id, { direct_sign_in: checked })}
                  />
                }
                label={t("vas.loginWithoutBinding")}
              />
              <NoMarginHelperText>{t("vas.loginWithoutBindingDes")}</NoMarginHelperText>
            </FormControl>
            {provider.type === "logto" && (
              <>
                <FormControl fullWidth>
                  <Typography variant="body2">{t("settings.logtoEndpoint")}</Typography>
                  <DenseFilledTextField
                    value={String(provider.config.endpoint ?? "")}
                    onChange={(e) => updateConfig(provider.id, { endpoint: e.target.value })}
                    placeholder="https://example.logto.app"
                    required={provider.enabled}
                  />
                  <NoMarginHelperText>{t("settings.logtoEndpointDes")}</NoMarginHelperText>
                </FormControl>
                <FormControl fullWidth>
                  <Typography variant="body2">{t("settings.logtoDirectSSO")}</Typography>
                  <DenseFilledTextField
                    value={String(provider.config.direct_sso ?? "")}
                    onChange={(e) => updateConfig(provider.id, { direct_sso: e.target.value })}
                    placeholder="e.g. social:google"
                  />
                  <NoMarginHelperText>{t("settings.logtoDirectSSODes")}</NoMarginHelperText>
                </FormControl>
              </>
            )}
            {provider.type === "oidc" && (
              <>
                <FormControl fullWidth>
                  <Typography variant="body2">{t("settings.oidcWellknown")}</Typography>
                  <SecondaryButton
                    variant="contained"
                    sx={{ mb: 1, alignSelf: "flex-start" }}
                    onClick={() => setWellknownImportOpen(provider.id)}
                  >
                    {t("settings.importFromWellknown")}
                  </SecondaryButton>
                  <TextField
                    fullWidth
                    multiline
                    minRows={6}
                    value={
                      wellknownDraft[provider.id] ?? JSON.stringify(provider.wellknown ?? {}, null, 2)
                    }
                    onChange={(e) => updateWellknown(provider, e.target.value)}
                    slotProps={{
                      input: {
                        sx: { fontFamily: "monospace", fontSize: "0.8rem" },
                      },
                    }}
                  />
                  <NoMarginHelperText>{t("settings.oidcWellknownDes")}</NoMarginHelperText>
                </FormControl>
                <Typography variant="body2" color="text.secondary">
                  {t("settings.oidcUserInfoFieldsMapping")}
                </Typography>
                {fieldMappings.map((field) => (
                  <FormControl fullWidth key={field.key}>
                    <DenseFilledTextField
                      value={String(provider.config[field.key] ?? "")}
                      placeholder={field.placeholder}
                      onChange={(e) => updateConfig(provider.id, { [field.key]: e.target.value })}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              {t(field.labelKey)}:
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                  </FormControl>
                ))}
                <NoMarginHelperText>{t("settings.oidcUserInfoFieldsMappingDes")}</NoMarginHelperText>
                <FormControl fullWidth>
                  <Typography variant="body2">{t("settings.oidcGroupField")}</Typography>
                  <DenseFilledTextField
                    value={String(provider.config.group_field_mapping ?? "")}
                    onChange={(e) =>
                      updateConfig(provider.id, { group_field_mapping: e.target.value || undefined })
                    }
                    placeholder="groups"
                  />
                  <NoMarginHelperText>{t("settings.oidcGroupFieldDes")}</NoMarginHelperText>
                </FormControl>
                <FormControl fullWidth>
                  <Typography variant="body2">{t("settings.oidcGroupMapping")}</Typography>
                  {getGroupMappingEntries(provider).map(([key, group], index) => (
                    <Box key={`${provider.id}-${index}`} sx={{ display: "flex", gap: 1, mt: 1 }}>
                      <Box sx={{ flex: 1 }}>
                        <DenseFilledTextField
                          fullWidth
                          value={key}
                          placeholder={t("settings.oidcGroupMappingValue")}
                          onChange={(e) => {
                            const next = [...getGroupMappingEntries(provider)] as [string, string][];
                            next[index] = [e.target.value, group];
                            updateGroupMapping(provider, next);
                          }}
                        />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 200 }}>
                        <GroupSelectionInput
                          value={group}
                          onChange={(value) => {
                            const next = [...getGroupMappingEntries(provider)] as [string, string][];
                            next[index] = [key, value];
                            updateGroupMapping(provider, next);
                          }}
                          fullWidth
                        />
                      </Box>
                      <IconButton
                        size="small"
                        aria-label="Delete group mapping"
                        onClick={() =>
                          updateGroupMapping(
                            provider,
                            getGroupMappingEntries(provider).filter((_, i) => i !== index),
                          )
                        }
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                  <Box sx={{ mt: 1 }}>
                    <IconButton
                      size="small"
                      aria-label="Add group mapping"
                      onClick={() =>
                        updateGroupMapping(provider, [
                          ...getGroupMappingEntries(provider),
                          ["", ""],
                        ])
                      }
                    >
                      <Add fontSize="small" />
                    </IconButton>
                  </Box>
                  <NoMarginHelperText>{t("settings.oidcGroupMappingDes")}</NoMarginHelperText>
                </FormControl>
              </>
            )}
          </AccordionDetails>
        </StyledAccordion>
      ))}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <SecondaryButton variant="contained" startIcon={<Add />} {...bindTrigger(addProviderPopup)}>
          {t("fileManager.add", { ns: "application" })}
        </SecondaryButton>
        <Menu
          onClose={closeAddProviderPopup}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
          {...addProviderMenuProps}
        >
          {(["qq", "logto", "oidc"] as ProviderType[]).map((type) => (
            <MenuItem key={type} onClick={() => addProvider(type)}>
              {providerTypeLabel(type, t)}
            </MenuItem>
          ))}
        </Menu>
      </Box>
      <Dialog
        open={wellknownImportOpen !== undefined}
        onClose={() => setWellknownImportOpen(undefined)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t("settings.importOidc")}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <DenseFilledTextField
              fullWidth
              value={wellknownImportOpen !== undefined ? (importUrls[wellknownImportOpen] ?? "") : ""}
              onChange={(e) => {
                if (wellknownImportOpen !== undefined) {
                  setImportUrls((current) => ({ ...current, [wellknownImportOpen]: e.target.value }));
                }
              }}
              placeholder="https://example.com/.well-known/openid-configuration"
            />
            <NoMarginHelperText>{t("settings.oidcWellknownUrlDes")}</NoMarginHelperText>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWellknownImportOpen(undefined)}>
            {t("common:cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={
              wellknownImportOpen === undefined ||
              !(importUrls[wellknownImportOpen] ?? "").trim() ||
              !!importing[wellknownImportOpen]
            }
            onClick={() => {
              const provider = providers.providers.find((item) => item.id === wellknownImportOpen);
              if (provider) {
                importWellknown(provider);
              }
            }}
          >
            {t("fileManager.import", { ns: "application" })}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SSOSettings;
