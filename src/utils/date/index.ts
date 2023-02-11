import { DateTime, Info } from 'luxon';

export const startOfMonth = (date: DateTime) => date.startOf('month');
export const endOfMonth = (date: DateTime) => date.endOf('month');

export const startOfWeek = (date: DateTime) => date.startOf('week');
export const endOfWeek = (date: DateTime) => date.endOf('week');

export const isToday = (date: DateTime) => DateTime.now().hasSame(date, 'day');
export const isShabat = (date: DateTime) => date.weekday === 6;

export const getWeekdays = () => {
  const list = Info.weekdaysFormat('short');
  const result = list;
  const sunday = result.pop();
  result.unshift(sunday!);
  return result;
};
