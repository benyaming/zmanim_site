import {ZmanimResponseDto} from '../zmanim/zmanim.response-dto';

export type ZmanimInfoModel = Omit<ZmanimResponseDto, 'settings'>;
