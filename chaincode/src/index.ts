import {type Contract} from 'fabric-contract-api';
import { MedskyContract } from './contract';

export const contracts: typeof Contract[] = [MedskyContract];