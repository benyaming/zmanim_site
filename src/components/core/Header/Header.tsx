import { Box, Select, Typography, MenuItem, FormControl } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import React from 'react';
import { useTranslation } from 'react-i18next';
import logo from '../../../assets/logo.svg';
import settings from '../../../assets/settings.svg';
import mapPin from '../../../assets/mappin.svg';
import russia from '../../../assets/russia.svg';

export const Header = () => {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 0,
        margin: 0,
        alignItems: 'center',
        width: 1,
        height: '6.3vh',
        backgroundColor: 'white',
        boxShadow: '5',
      }}
    >
      <Box
        sx={{
          height: 0.5,
          width: '3.15vh',
          backgroundImage: logo,
          ml: '4%',
          backgroundImage: `url(${logo})`,
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
        }}
      />

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 0.5,
          mr: '4%',
          width: 0.15,
        }}
      >
        <Box
          sx={{
            height: 0.6,
            aspectRatio: '1/1',
            backgroundImage: logo,
            ml: '4%',
            backgroundImage: `url(${mapPin})`,
            backgroundSize: '100%',
            backgroundRepeat: 'no-repeat',
          }}
        />
        <Typography> Ashdod</Typography>
        <FormControl variant="standard" sx={{ minWidth: 120, height: 10, display: 'flex', justifyContent: 'center' }}>
          <Select
            defaultValue={10}
            sx={{
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <MenuItem value={10}>
              <img src={russia} style={{ marginRight: '8px' }} />
              Russian
            </MenuItem>
            <MenuItem value={20}>Hebrew</MenuItem>
            <MenuItem value={30}>English</MenuItem>
          </Select>
        </FormControl>
        <Box
          sx={{
            height: 1,
            aspectRatio: '1/1',
            backgroundImage: `url(${settings})`,
            backgroundSize: '70%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            borderRadius: '3px',
            borderColor: 'gray',
            boxShadow: 5,
          }}
        />
      </Box>
    </Box>
  );
};
