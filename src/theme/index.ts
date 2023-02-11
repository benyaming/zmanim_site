/* eslint-disable @typescript-eslint/no-empty-interface */
import { createTheme, PaletteColor, PaletteColorOptions } from '@mui/material';

export const themeColors = {
  primary: '#C6DEF4',
  white: '#ffffff',
  primaryHoliday: '#EDBDD4',
  secondaryHoliday: '#F8E6EF',
  roshHodesh: '#C6DEF4',
  error: '#FF5C67',
  success: '#3DB465',
  disabledBackground: '#ADB0B5',
  disabled: '#F2F2F2',
  neutral: '#DCDCE2',
  monochrome: '#000',
  text: '#2C2D35',
};

export const theme = createTheme({
  typography: {
    fontFamily: ['Roboto'].join(','),
  },
  spacing: 4,
  components: {
    MuiButton: {
      defaultProps: {
        variant: 'contained',
        color: 'white',
        disableElevation: true,
        size: 'large',
      },
      styleOverrides: {
        root: {
          borderRadius: '4px',
          textTransform: 'none',
          fontFamily: 'Roboto',
          fontWeight: 500,
          fontSize: '14px',
          padding: '12px 16px',
          border: '2px solid #DCDCE2',
          lineHeight: '16px',
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
    white: {
      main: themeColors.white,
      contrastText: themeColors.text,
    },
    action: {
      disabledBackground: themeColors.disabledBackground,
      disabled: themeColors.disabled,
    },
    primaryHoliday: {
      main: themeColors.primaryHoliday,
      contrastText: '#FFF',
    },
    secondaryHoliday: {
      main: themeColors.secondaryHoliday,
      contrastText: '#FFF',
    },
    monochrome: {
      main: themeColors.monochrome,
      contrastText: '#FFF',
    },
    neutral: {
      main: themeColors.neutral,
      contrastText: '#72758A',
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
    white: true;
  }
}

declare module '@mui/material/styles' {
  interface Palette {
    white: PaletteColor;
    neutral: PaletteColor;
    monochrome: PaletteColor;
    primaryHoliday: PaletteColor;
    secondaryHoliday: PaletteColor;
  }

  interface PaletteOptions {
    white: PaletteColorOptions;
    neutral: PaletteColorOptions;
    monochrome: PaletteColorOptions;
    primaryHoliday: PaletteColorOptions;
    secondaryHoliday: PaletteColorOptions;
  }
}
