//  Copyright PrimeObjects Software Inc. and other contributors <https://www.primeobjects.com/>
// 
//  This source code is licensed under the MIT license.
//  The detail information can be found in the LICENSE file in the root directory of this source tree.

import { isNonEmptyString } from 'douhub-helper-util';

export const RESOURCE_PREFIX = process.env.RESOURCE_PREFIX;
export const DYNAMO_DB_TABLE_NAME_PROFILE = `${RESOURCE_PREFIX}-profile`;
export const DYNAMO_DB_TABLE_NAME_CACHE = `${RESOURCE_PREFIX}-cache`;
export const S3_BUCKET_NAME_DATA = `${RESOURCE_PREFIX}-data`;
export const AWS_REGION = isNonEmptyString(process.env.REGION) ? `${process.env.REGION}` : 'us-east-1';
export const AWS_SECRET_ID = isNonEmptyString(process.env.AWS_SECRET_ID)?process.env.AWS_SECRET_ID:RESOURCE_PREFIX;
