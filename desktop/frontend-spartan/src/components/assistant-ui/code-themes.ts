import oneDarkPro from "@shikijs/themes/one-dark-pro";
import oneLight from "@shikijs/themes/one-light";
import type { ThemeRegistrationAny } from "shiki";

// Canonical Atom One Dark / One Light themes from `@shikijs/themes`. Only the
// background is overridden so the code block blends into the app's `--code-block`
// surface; all token colors/scopes are kept intact for consistent multi-language
// highlighting out of the box.
const withTransparentBg = (
  theme: ThemeRegistrationAny,
): ThemeRegistrationAny => ({
  ...theme,
  bg: "transparent",
  colors: {
    ...theme.colors,
    "editor.background": "transparent",
  },
});

export const spartanLightTheme: ThemeRegistrationAny = {
  ...withTransparentBg(oneLight),
  name: "spartan-light",
};

export const spartanDarkTheme: ThemeRegistrationAny = {
  ...withTransparentBg(oneDarkPro),
  name: "spartan-dark",
};
