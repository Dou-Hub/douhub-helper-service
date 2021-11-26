//  Copyright PrimeObjects Software Inc. and other contributors <https://www.primeobjects.com/>
// 
//  This source code is licensed under the MIT license.
//  The detail information can be found in the LICENSE file in the root directory of this source tree.

import { SecretsManager } from 'aws-sdk';
import { SECRET_ID} from './constants';

let _secret: any = null; //global variable to keep as cache
const _secretsManager: SecretsManager = new SecretsManager({ region: process.env.REGION });

export const getSecret = async (): Promise<Record<string,any>> => {
    // Create a Secrets Manager client
    if (!_secret) _secret = await _secretsManager.getSecretValue({ SecretId: SECRET_ID }).promise();

    if ('SecretString' in _secret) {
        return JSON.parse(_secret.SecretString);
    } else {
        let buff = Buffer.from(_secret.SecretBinary, 'base64');
        return JSON.parse(buff.toString('ascii'));
    }
};


export const getSecretValue = async (name:string): Promise<string> => {
    const secret = await getSecret();
    return secret?.name;
};


