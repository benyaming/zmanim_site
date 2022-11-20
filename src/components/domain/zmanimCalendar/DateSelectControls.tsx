import { ChevronDownIcon } from '@chakra-ui/icons';
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Select,
} from '@chakra-ui/react';
import { format, getDay, getDaysInMonth, getMonth, getYear } from 'date-fns';
import { JewishCalendar, JewishDate } from 'kosher-zmanim';
import * as KosherZmanim from 'kosher-zmanim';
import { capitalize } from 'lodash';
import { Info } from 'luxon';
import React, { FocusEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCalendar } from '../../../providers/CalendarProvide';
import { timeLocales } from '../../../services/locales';
import { Formatter } from '../../../services/zmanim/formatter';
import { LanguageVariant } from '../../../types/i18n';

export interface ZmanimCalendarDayProps {
  handleChange: (value: number, type: 'year' | 'month' | 'day') => void;
  date: Date;
}

export const DateSelectControls = (props: ZmanimCalendarDayProps) => {
  const { handleChange } = props;
  const { date, isHebrew } = useCalendar();
  const { i18n, t } = useTranslation();
  const currentLang = i18n.language as LanguageVariant;
  const [year, setYear] = useState(getYear(date).toString());
  const [month, setMonth] = useState(getMonth(date).toString());

  const jewDate = new JewishDate(date);

  const handleYear = (e: FocusEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (!value) return;
    if (isHebrew) {
      jewDate.setJewishYear(parseInt(value, 10));
      value = jewDate.getGregorianYear().toString();
    }
    handleChange(parseInt(value, 10), 'year');
  };

  const handleMonth = (value: number) => {
    let localValue = value;
    setMonth(value.toString());
    if (isHebrew) {
      jewDate.setJewishMonth(value + 1);
      localValue = jewDate.getGregorianMonth();
    }
    handleChange(localValue, 'month');
  };

  const generateMonthList = () => {
    if (!isHebrew) return Info.months('long', { locale: i18n.language });
    const cloneJewDate = jewDate.clone();
    const list = [];
    const monthNumber = cloneJewDate.isJewishLeapYear() ? 13 : 12;
    for (let i = 1; i < monthNumber; i++) {
      cloneJewDate.setJewishMonth(i);
      list.push(Formatter.formatMonth(cloneJewDate));
    }
    return list;
  };

  const monthList = generateMonthList();

  const currentMonth = (number: number) => {
    if (isHebrew) return monthList[jewDate.getJewishMonth() - 1];
    return monthList[number];
  };

  useEffect(() => {
    if (isHebrew) {
      setYear(jewDate.getJewishYear().toString());
      setMonth(jewDate.getJewishMonth().toString());
    } else {
      setYear(getYear(date).toString());
      setMonth(getMonth(date).toString());
    }
  }, [isHebrew, date]);

  return (
    <Flex py={2} gap={4}>
      <Flex>
        <FormControl>
          <Flex alignItems="center">
            <FormLabel htmlFor="year">{t('times.year')}</FormLabel>
            <Input
              onChange={(e) => setYear(e.target.value)}
              value={year}
              id="year"
              type="phone"
              onBlur={(e) => handleYear(e)}
            />
          </Flex>
        </FormControl>
      </Flex>
      <Flex>
        <FormControl>
          <Flex alignItems="center">
            <FormLabel>{t('times.month')}</FormLabel>
            <Menu>
              <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
                {format(date, 'MMMM', { locale: timeLocales[currentLang] })}
              </MenuButton>
              <MenuList>
                {monthList.map((m, i) => (
                  <MenuItem key={m} onClick={() => handleMonth(i)}>
                    {m}
                  </MenuItem>
                ))}
              </MenuList>
            </Menu>
          </Flex>
        </FormControl>
      </Flex>
    </Flex>
  );
};
