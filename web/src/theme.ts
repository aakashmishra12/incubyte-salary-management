import { createTheme } from '@mui/material/styles';

/**
 * The look of the whole app, in one place.
 * The values come from docs/design/DESIGN.md. MUI components read them from the theme,
 * so no screen sets its own colours, fonts or corner sizes.
 */

// Colours, named as in DESIGN.md.
const ink = '#171717';
const body = '#4d4d4d';
const mute = '#888888';
const hairline = '#ebebeb';
const canvas = '#ffffff';
const canvasSoft = '#fafafa';
const canvasSoft2 = '#f5f5f5';
const link = '#0070f3';
const warningDeep = '#ab570a';

const sans = "'Geist Variable', Inter, system-ui, -apple-system, sans-serif";
const mono = "'Geist Mono Variable', ui-monospace, SFMono-Regular, Menlo, Monaco, monospace";

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
  fontSize: 12,
  lineHeight: '16px',
  fontWeight: 400,
  letterSpacing: 0,
  textTransform: 'uppercase',
  color: mute,
} as const;

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: ink, contrastText: canvas },
    secondary: { main: body },
    error: { main: '#ee0000', dark: '#c50000', light: '#f7d4d6' },
    warning: { main: '#f5a623', dark: warningDeep, light: '#ffefcf' },
    info: { main: link, dark: '#0761d1', light: '#d3e5ff' },
    // The design uses its blue for "success" too. There is no green in it.
    success: { main: link, dark: '#0761d1', light: '#d3e5ff' },
    text: { primary: ink, secondary: body, disabled: mute },
    background: { default: canvasSoft, paper: canvas },
    divider: hairline,
  },
  shape: { borderRadius: radiusControl },
  typography: {
    fontFamily: sans,
    // Headings: weight 600 at most, tight letter spacing, never capitals.
    h4: { fontSize: 32, lineHeight: '40px', fontWeight: 600, letterSpacing: '-1.28px' },
    h5: { fontSize: 24, lineHeight: '32px', fontWeight: 600, letterSpacing: '-0.96px' },
    h6: { fontSize: 20, lineHeight: '28px', fontWeight: 600, letterSpacing: '-0.6px' },
    body1: { fontSize: 16, lineHeight: '24px' },
    body2: { fontSize: 14, lineHeight: '20px', letterSpacing: '-0.28px' },
    caption: { fontSize: 12, lineHeight: '16px' },
    overline: monoLabel,
    button: { fontSize: 14, lineHeight: '20px', fontWeight: 500, textTransform: 'none' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '::selection': { backgroundColor: ink, color: '#f2f2f2' },
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
        { props: { variant: 'outlined', color: 'warning' }, style: { color: warningDeep } },
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
        root: { fontSize: 20, lineHeight: '28px', fontWeight: 600, letterSpacing: '-0.6px' },
      },
    },
    MuiMenu: {
      styleOverrides: { paper: { borderRadius: radiusCard, boxShadow: shadowMenu } },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: 14,
          '&:hover': { backgroundColor: canvasSoft2 },
          '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: canvasSoft2 },
        },
      },
    },
    // Inputs: white, hairline border, 14px text. The border turns ink when focused.
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: canvas,
          fontSize: 14,
          borderRadius: radiusControl,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: hairline },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#a1a1a1' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ink, borderWidth: 1 },
        },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontSize: 14 } } },
    // Tables: mono capital headings on a soft band, 14px rows, hairline row lines.
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottomColor: hairline, fontSize: 14, letterSpacing: '-0.28px' },
        head: { ...monoLabel, backgroundColor: canvasSoft, whiteSpace: 'nowrap' },
      },
    },
    MuiTableSortLabel: {
      styleOverrides: {
        root: { color: mute, '&.Mui-active': { color: ink }, '&:hover': { color: ink } },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        selectLabel: { fontSize: 14 },
        displayedRows: { fontSize: 14 },
      },
    },
    // Badges: small, fully rounded, quiet.
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 9999, fontSize: 12, height: 22 },
        outlined: { backgroundColor: canvasSoft, borderColor: hairline },
        colorWarning: { color: warningDeep },
      },
    },
    MuiLink: { styleOverrides: { root: { color: link } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: radiusCard } } },
    MuiLinearProgress: {
      styleOverrides: { root: { backgroundColor: hairline, height: 2 } },
    },
  },
});
