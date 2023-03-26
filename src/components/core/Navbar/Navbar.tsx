import PlaceIcon from '@mui/icons-material/Place';
import { AppBar, Box, Dialog, DialogContent, IconButton, Stack, Toolbar } from '@mui/material';
import React from 'react';

import text from '../../../assets/zmanim-text.svg';
import logo from '../../../assets/zmanin-logo.svg';
import { MapboxMap } from '../../domain';
import { LangSwitch } from '../locale';

export const Navbar = () => {
  const [open, setOpen] = React.useState(false);
  return (
    <AppBar
      position="static"
      sx={{
        background: 'white',
        borderRadius: 0,
      }}
    >
      <Toolbar
        sx={{
          width: '100%',
          boxShadow: '0px 1px 8px rgba(114, 117, 138, 0.15);',
        }}
      >
        <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg">
          <DialogContent>
            <MapboxMap />
          </DialogContent>
        </Dialog>
        <Box display="flex" width="100%" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <img alt="logo" src={logo} width="32px" height="28px" />
            <img alt="text" src={text} width="72px" height="15px" />
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <IconButton aria-label="delete" onClick={() => setOpen(true)}>
              <PlaceIcon />
            </IconButton>
            <LangSwitch />
          </Stack>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
