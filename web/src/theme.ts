import { createTheme } from '@mui/material/styles';

/**
 * The look of the whole app, in one place.
 * The values come from docs/design/DESIGN.md. MUI components read them from the theme,
 * so no screen sets its own colours, fonts or corner sizes.
 *
 * Where the design's own values fail WCAG AA contrast, a slightly stronger value is used and the
 * reason is written next to it. docs/design/README.md lists every such change. theme.test.ts checks
 * the contrast ratios, so a change here that makes text unreadable fails a test.
 */

// Colours, named as in DESIGN.md.
const ink = '#171717';
const body = '#4d4d4d';
const hairline = '#ebebeb';
const canvas = '#ffffff';
const canvasSoft = '#fafafa';
const canvasSoft2 = '#f5f5f5';

// Changed for contrast. The design's "mute" #888 is only 3.5 to 1 on white, and the text needs 4.5.
const muted = '#666666';
// The design's link blue #0070f3 is 4.4 to 1 on the off-white page. Its "link-deep" is 5.5.
const link = '#0761d1';
// The design's error red #ee0000 is 4.3 to 1 on the off-white page. Its "error-deep" is 6.0.
const errorText = '#c50000';
// The design's amber is not readable as text on white, so text uses its deep amber.
const warningText = '#ab570a';
// The design's input border (hairline #ebebeb) is 1.2 to 1. A control's edge needs 3 to 1.
const inputBorder = '#8a8a8a';

/** The values that matter for contrast, exported so a test can check them. */
export const tokens = {
  ink,
  body,
  muted,
  hairline,
  canvas,
  canvasSoft,
  canvasSoft2,
  link,
  errorText,
  warningText,
  inputBorder,
};

const sans = "'Geist Variable', Inter, system-ui, -apple-system, sans-serif";
const mono = "'Geist Mono Variable', ui-monospace, SFMono-Regular, Menlo, Monaco, monospace";

/** Text is sized in rem, so it grows when the person raises the font size in their browser. */
const rem = (px: number) => `${px / 16}rem`;

// Corner sizes: 6px for controls, 8px for panels, 12px for dialogs.
const radiusControl = 6;
const radiusCard = 8;
const radiusDialog = 12;

// The design never uses one heavy shadow. It stacks small ones on a 1px ring.
const ring = '0 0 0 1px #00000014';
const shadowMenu = `${ring}, 0px 2px 2px #0000000a, 0px 8px 16px -4px #0000000a`;
const shadowDialog = `${ring}, 0px 1px 1px #00000005, 0px 8px 16px -4px #0000000a, 0px 24px 32px -8px #0000000f`;

/** Small technical labels: mono, capitals, muted. Used for table headings and stat labels. */
const monoLabel = {
  fontFamily: mono,
  fontSize: rem(12),
  lineHeight: 16 / 12,
  fontWeight: 400,
  letterSpacing: 0,
  textTransform: 'uppercase',
  color: muted,
} as const;

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: ink, contrastText: canvas },
    secondary: { main: body },
    error: { main: errorText, dark: '#a00000', light: '#f7d4d6' },
    warning: { main: '#f5a623', dark: warningText, light: '#ffefcf' },
    info: { main: link, dark: '#0757b0', light: '#d3e5ff' },
    // The design uses its blue for "success" too. There is no green in it.
    success: { main: link, dark: '#0757b0', light: '#d3e5ff' },
    text: { primary: ink, secondary: body, disabled: '#8f8f8f' },
    background: { default: canvasSoft, paper: canvas },
    divider: hairline,
  },
  shape: { borderRadius: radiusControl },
  typography: {
    fontFamily: sans,
    // Headings: weight 600 at most, tight letter spacing, never capitals.
    h4: { fontSize: rem(32), lineHeight: 40 / 32, fontWeight: 600, letterSpacing: '-1.28px' },
    h5: { fontSize: rem(24), lineHeight: 32 / 24, fontWeight: 600, letterSpacing: '-0.96px' },
    h6: { fontSize: rem(20), lineHeight: 28 / 20, fontWeight: 600, letterSpacing: '-0.6px' },
    body1: { fontSize: rem(16), lineHeight: 24 / 16 },
    body2: { fontSize: rem(14), lineHeight: 20 / 14, letterSpacing: '-0.28px' },
    caption: { fontSize: rem(12), lineHeight: 16 / 12 },
    overline: monoLabel,
    button: { fontSize: rem(14), lineHeight: 20 / 14, fontWeight: 500, textTransform: 'none' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '::selection': { backgroundColor: ink, color: '#f2f2f2' },
        // Whatever has keyboard focus gets a clear ring. (The design shows focus only as a colour change.)
        ':focus-visible': { outline: `2px solid ${ink}`, outlineOffset: '2px' },
        // For people who ask their system for less motion: no animations or smooth scrolling.
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      },
    },
    // The top bar: white, 64px tall, separated from the page by a hairline.
    MuiAppBar: {
      defaultProps: { color: 'inherit', elevation: 0 },
      styleOverrides: {
        root: { backgroundColor: canvas, borderBottom: `1px solid ${hairline}` },
      },
    },
    MuiToolbar: { styleOverrides: { root: { minHeight: '64px !important' } } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: radiusControl, minHeight: 36 },
        // The secondary button: white with a hairline, ink text.
        outlined: { backgroundColor: canvas, borderColor: hairline },
      },
      // Amber text on white is hard to read, so an outlined warning button uses the deep amber.
      variants: [
        { props: { variant: 'outlined', color: 'warning' }, style: { color: warningText } },
      ],
    },
    // Panels are flat, held on the page by a hairline.
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        rounded: { borderRadius: radiusCard },
        outlined: { borderColor: hairline },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: radiusDialog, boxShadow: shadowDialog } },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: rem(20),
          lineHeight: 28 / 20,
          fontWeight: 600,
          letterSpacing: '-0.6px',
        },
      },
    },
    MuiMenu: {
      styleOverrides: { paper: { borderRadius: radiusCard, boxShadow: shadowMenu } },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: rem(14),
          '&:hover': { backgroundColor: canvasSoft2 },
          '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: canvasSoft2 },
        },
      },
    },
    // Inputs: white, a border strong enough to see, 14px text. The border turns ink when focused.
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: canvas,
          fontSize: rem(14),
          borderRadius: radiusControl,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: inputBorder },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: body },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ink, borderWidth: 1 },
        },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontSize: rem(14) } } },
    // Tables: mono capital headings on a soft band, 14px rows, hairline row lines.
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottomColor: hairline, fontSize: rem(14), letterSpacing: '-0.28px' },
        head: { ...monoLabel, backgroundColor: canvasSoft, whiteSpace: 'nowrap' },
      },
    },
    MuiTableSortLabel: {
      styleOverrides: {
        root: { color: muted, '&.Mui-active': { color: ink }, '&:hover': { color: ink } },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        selectLabel: { fontSize: rem(14) },
        displayedRows: { fontSize: rem(14) },
      },
    },
    // Badges: small, fully rounded, quiet.
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 9999, fontSize: rem(12), height: rem(22) },
        outlined: { backgroundColor: canvasSoft, borderColor: hairline },
        colorWarning: { color: warningText },
      },
    },
    MuiLink: { styleOverrides: { root: { color: link } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: radiusCard } } },
    MuiLinearProgress: {
      styleOverrides: { root: { backgroundColor: hairline, height: 2 } },
    },
  },
});
