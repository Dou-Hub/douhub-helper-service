//  Copyright PrimeObjects Software Inc. and other contributors <https://www.primeobjects.com/>
// 
//  This source code is licensed under the MIT license.
//  The detail information can be found in the LICENSE file in the root directory of this source tree.

import { SecretsManager } from 'aws-sdk';
import { AWS_SECRET_ID, AWS_REGION } from './constants';
import { isObject, _track, _process } from 'douhub-helper-util';


export const getSecret = async (region?: string): Promise<Record<string, any>> => {
    if (!region) region = _process.env.REGION;
    if (!region) region = 'us-east-1';
    try {
        // Create a Secrets Manager client
        if (!_process._secret || !_process._secretsManager) {
            _process._secretsManager = new SecretsManager({ region });
            _process._secret = await _process._secretsManager.getSecretValue({ SecretId: AWS_SECRET_ID }).promise();
        }

        if ('SecretString' in _process._secret) {
            return JSON.parse(_process._secret.SecretString);
        } else {
            let buff = Buffer.from(_process._secret.SecretBinary, 'base64');
            return JSON.parse(buff.toString('ascii'));
        }
    } catch (error: any) {
        if (_track) console.error({error, AWS_REGION, AWS_SECRET_ID});
        throw error;
    }
};


export const getSecretValue = async (name: string, region?: string): Promise<string> => {
    const secret = await getSecret(region);
    return isObject(secret) ? secret[name] : null;
};
