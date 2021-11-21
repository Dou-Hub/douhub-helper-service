//  Copyright PrimeObjects Software Inc. and other contributors <https://www.primeobjects.com/>
// 
//  This source code is licensed under the MIT license.
//  The detail information can be found in the LICENSE file in the root directory of this source tree.

import Constants from './libs/constants';
import Colors from './libs/colors';
import Core from './libs/core';
export {
    getBaseDomain
} from './libs/web';

export const isNonEmptyString = Core.isNonEmptyString;
export const isGuid = Core.isGuid;
export const isPhoneNumber = Core.isPhoneNumber;
export const isEmptyString = Core.isEmptyString;
export const newGuid = Core.newGuid;
export const assignDeep = Core.assignDeep;
export const assignStyles = Core.assignStyles;
export const getWebLocation = Core.getWebLocation;
export const fixUrl = Core.fixUrl;
export const getSubObject = Core.getSubObject;
export const timeDiff = Core.timeDiff;
export const serialNumber = Core.serialNumber;
export const ttl = Core.ttl;
export const getObjectPropValue = Core.getObjectPropValue;
export const getIntValueOfObject = Core.getIntValueOfObject;
export const getArrayPropValueOfObject = Core.getArrayPropValueOfObject;
export const getPropValueOfObject = Core.getPropValueOfObject;
export const getMemoryCache = Core.getMemoryCache;
export const setMemoryCache = Core.setMemoryCache;
export const cleanGuid = Core.cleanGuid;
export const sameGuid = Core.sameGuid;
export const isEmptyGuid = Core.isEmptyGuid;
export const checkToTrue = Core.checkToTrue;
export const isIntString = Core.isIntString;
export const isFloatString = Core.isFloatString;
export const isEmail = Core.isEmail;
export const isPassword = Core.isPassword;
export const utcISOString = Core.utcISOString;
export const utcMaxISOString = Core.utcMaxISOString;

export const colorByName = Colors.colorByName;
export const rgbToHex = Colors.rgbToHex;
export const isValidRGB = Colors.isValidRGB;
export const hexToRgb = Colors.hexToRgb;
export const isValidHex = Colors.isValidHex;
export const intToHex = Colors.intToHex;
export const APPTEXTCOLORS = Colors.APPTEXTCOLORS;
export const APPBGCOLORS = Colors.APPBGCOLORS;
export const APPCOLORS = Colors.APPCOLORS;
export const COLORS = Colors.COLORS;
export const BASECOLORS = Colors.BASECOLORS;

export const GUID_PRE = Constants.GUID_PRE;
export const GUID_EMPTY = Constants.GUID_EMPTY;
export const GUID_00001 = Constants.GUID_00001;
export const GUID_00002 = Constants.GUID_00002;
export const GUID_00003 = Constants.GUID_00003;
export const GUID_00004 = Constants.GUID_00004;
export const GUID_00005 = Constants.GUID_00005;
export const GUID_00010 = Constants.GUID_00010;
export const GUID_00020 = Constants.GUID_00020;
export const GUID_00030 = Constants.GUID_00030;
export const GUID_00040 = Constants.GUID_00040;
export const GUID_00050 = Constants.GUID_00050;