import styled from '@emotion/styled';
import { KeyboardArrowDown } from '@mui/icons-material';
import { Box, Menu, MenuItem } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

import il from '../../../assets/flags/il.svg';
import ru from '../../../assets/flags/ru.svg';
import us from '../../../assets/flags/us.svg';
import { Text } from '../typography';

const FlagImg = styled.img`
  border-radius: 50%;
  margin-right: 4px;
  width: 24px;
`;

const flagMap = {
  en: us,
  he: il,
  ru,
};

type Languages = 'en' | 'he' | 'ru';
export const LangSwitch = () => {
  const { t, i18n } = useTranslation();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [lang, setLang] = React.useState<Languages>('en');

  const langMap = {
    en: t('languages.english'),
    he: t('languages.hebrew'),
    ru: t('languages.russian'),
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  const handleChange = (lang: Languages) => {
    i18n.changeLanguage(lang).then(() => {
      setLang(lang);
      handleClose();
    });
  };
  return (
    <Box sx={{ cursor: 'pointer' }}>
      <Box alignItems="center" display="flex" onClick={(e) => setAnchorEl(e.currentTarget)}>
        <FlagImg src={flagMap[lang]} alt="flag" width="38px" />
        <Text>{langMap[lang]}</Text>
        <KeyboardArrowDown />
      </Box>
      <Menu id="lang-switch" anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
        <MenuItem onClick={() => handleChange('en')} value="en">
          <FlagImg src={us} alt="flag" /> <Text>{t('languages.english')}</Text>
        </MenuItem>
        <MenuItem onClick={() => handleChange('he')} value="he">
          <FlagImg src={il} alt="flag" /> <Text>{t('languages.hebrew')}</Text>
        </MenuItem>
        <MenuItem onClick={() => handleChange('ru')} value="ru">
          <FlagImg src={ru} alt="flag" /> <Text>{t('languages.russian')}</Text>
        </MenuItem>
      </Menu>
    </Box>
  );
};
