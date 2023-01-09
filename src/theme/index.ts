/* eslint-disable @typescript-eslint/no-empty-interface */
import { createTheme, PaletteColor, PaletteColorOptions } from '@mui/material';

export const themeColors = {
  primary: '#008EF7',
  error: '#FF5C67',
  success: '#3DB465',
  disabledBackground: '#ADB0B5',
  disabled: '#F2F2F2',
  neutral: '#ADB0B5',
  monochrome: '#000',
};

export const theme = createTheme({
  typography: {
    fontFamily: ['SF Pro', 'Pilat Extended'].join(','),
  },
  spacing: 4,
  components: {
    MuiButton: {
      defaultProps: {
        disableRipple: true,
        variant: 'contained',
        color: 'primary',
        disableElevation: true,
        size: 'medium',
      },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontFamily: 'Pilat Extended',
          fontWeight: 900,
          fontSize: '12px',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          fontSize: '14px',
          fontWeight: 400,
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 3,
      },
      styleOverrides: {
        root: {
          borderRadius: '8px',
        },
      },
    },
    MuiCheckbox: {
      defaultProps: {
        disableRipple: true,
      },
    },
    MuiList: {
      styleOverrides: {
        root: {
          borderRadius: '4px',
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        size: 'medium',
      },
      styleOverrides: {
        select: {
          backgroundColor: '#FFF',
        },
      },
    },
  },
  palette: {
    action: {
      disabledBackground: themeColors.disabledBackground,
      disabled: themeColors.disabled,
    },
    monochrome: {
      main: themeColors.monochrome,
      contrastText: '#FFF',
    },
    neutral: {
      main: themeColors.neutral,
      contrastText: '#FFF',
    },
    primary: {
      main: themeColors.primary,
    },
    error: {
      main: themeColors.error,
    },
    success: {
      main: themeColors.success,
    },
  },
});

import { Theme as MaterialTheme } from '@mui/material';

declare module '@emotion/react' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface Theme extends MaterialTheme {}
}

declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    neutral: true;
    primary: true;
    monochrome: true;
  }
}

declare module '@mui/material/styles' {
  interface Palette {
    neutral: PaletteColor;
    monochrome: PaletteColor;
  }
  interface PaletteOptions {
    neutral: PaletteColorOptions;
    monochrome: PaletteColorOptions;
  }
}
