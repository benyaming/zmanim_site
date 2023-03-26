import PlaceIcon from '@mui/icons-material/Place';
import SettingsIcon from '@mui/icons-material/Settings';
import { AppBar, Box, Button, Dialog, DialogContent, Icon, IconButton, Stack, Toolbar } from '@mui/material';
import React, { useState } from 'react';

import text from '../../../assets/zmanim-text.svg';
import logo from '../../../assets/zmanin-logo.svg';
import { useGetPlaces } from '../../../hooks/rq/useGetPlaces';
import { useGeolocation } from '../../../providers/GeoProvider';
import { MapboxMap } from '../../domain';
import { LangSwitch } from '../locale/';
import { Text } from '../typography';

export const Navbar = () => {
  const [open, setOpen] = React.useState(false);
  const [city, setCity] = useState('');
  const {
    latLng: { lat, lng },
  } = useGeolocation();
  useGetPlaces(
    { lat, lng },
    {
      onSuccess: (data) => {
        setCity(data?.features[0]?.context[0]?.text);
      },
    },
  );
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
            <Text> {city || ''}</Text>
            <IconButton aria-label="delete" onClick={() => setOpen(true)}>
              <PlaceIcon />
            </IconButton>
            <LangSwitch />
            <Button sx={{ width: '38px', height: '38px', minWidth: 'unset' }}>
              <Icon>
                <SettingsIcon />
              </Icon>
            </Button>
          </Stack>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
