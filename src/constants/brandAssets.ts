import whiteSymbolUrl from "@/assets/img/logsymbolwhite.png";

export const DARK_SURFACE_LOGO = whiteSymbolUrl;
export const USER_AVATAR_PLACEHOLDER = whiteSymbolUrl;

export function resolveUserAvatar(value?: string | null): string {
  const candidate = String(value ?? "").trim();
  if (!candidate || /(?:base64,)?(?:null|undefined)$/i.test(candidate)) {
    return USER_AVATAR_PLACEHOLDER;
  }
  return candidate;
}
