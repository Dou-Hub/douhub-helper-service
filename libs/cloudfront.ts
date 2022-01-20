//  Copyright PrimeObjects Software Inc. and other contributors <https://www.primeobjects.com/>
// 
//  This source code is licensed under the MIT license.
//  The detail information can be found in the LICENSE file in the root directory of this source tree.


import { isNil } from 'lodash';
import { _process, _track } from 'douhub-helper-util';
import { CloudFront } from 'aws-sdk';
import { getSecretValue } from './secret-manager';

export const getCloudFront = async () => {


    if (isNil(_process.signer)) {
        const keypairId = await getSecretValue('CLOUDFRONT_KEY');
        const privateKey = (await getSecretValue('CLOUDFRONT_PK')).replace(/\|/g, '\r\n');;
        _process.signer = new CloudFront.Signer(keypairId, privateKey);

    }
    return _process.signer;
}

export const cloudFrontSignedCookieForFolder = async (domainName: string, folderName: string, expireInSeconds: number) => {

    const expires = Math.floor((Date.now() + expireInSeconds * 1000) / 1000);
    const url = `https://${domainName}/${folderName}/*`;

    try {

        const signedCookies = (await getCloudFront()).getSignedCookies({ url, expires });
        return signedCookies;
        // const result: Record<string,any> = {};
        // result.policy = signedCookies['CloudFront-Policy'];
        // result.signature = signedCookies['CloudFront-Signature'];
        // result.keyPairId = signedCookies['CloudFront-Key-Pair-Id'];
        // result.domain = context.domain;
        // result.location = url.replace('*', fileName);
        // return result;
    }
    catch (error) {
        if (_track) console.error({ source: 'signedUrl', error, url, expireInSeconds, expires });
        throw error;
    }

}

//https://medium.com/roam-and-wander/using-cloudfront-signed-urls-to-serve-private-s3-content-e7c63ee271db
export const cloudFrontSignedUrl = async (url: string, expireInSeconds: number) => {
    const expires = Math.floor((Date.now() + expireInSeconds * 1000) / 1000);
    try {
        const signedUrl = (await getCloudFront()).getSignedUrl({ url, expires });
        return signedUrl;
    }
    catch (error) {
        if (_track) console.error({ source: 'signedUrl', error, url, expireInSeconds, expires });
        throw error;
    }
}
