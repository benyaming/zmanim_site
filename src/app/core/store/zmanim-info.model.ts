import {ZmanimResponseDto} from '@core/zmanim';

export type ZmanimInfoModel = Omit<ZmanimResponseDto, 'settings'>;
