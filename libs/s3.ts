//  Copyright PrimeObjects Software Inc. and other contributors <https://www.primeobjects.com/>
// 
//  This source code is licensed under the MIT license.
//  The detail information can be found in the LICENSE file in the root directory of this source tree.


import { S3 } from 'aws-sdk';
import { isNil } from 'lodash';
import { isNonEmptyString, getContentType } from 'douhub-helper-util';
const _s3: Record<string, any> = {};

export const getS3 = (region?: string) => {
    region = region?region:'us-east-1';
    if (!_s3[region]) _s3[region] = new S3({ region });
    return _s3[region];
}

export const s3Exist = async (bucketName: string, fileName: string, region?: string) => {
    return new Promise(function (resolve, reject) {
        getS3(region).headObject({
            Bucket: bucketName,
            Key: fileName
        }, function (err: any) {
            if (err) {
                reject(err);
            }
            else {
                resolve(true);
            }
        });
    });
};

export const s3Put = async (bucketName: string, fileName: string, content: string, region?: string) => {
    await getS3(region).putObject({
        Bucket: bucketName,
        Key: fileName,
        Body: content
    }).promise();
};

export const s3PutObject = async (bucketName: string, fileName: string, content: Record<string, any>, region?: string) => {
    await await s3Put(bucketName, fileName, isNil(content) ? '' : JSON.stringify(content), region);
};

export const s3Get = async (bucketName: string, fileName: string, region?: string, versionId?: string)
    : Promise<{
        versionId: string,
        isLatest: boolean,
        size: number,
        modifiedOn: string,
        content: string
    }> => {

    // const params = versionId ? {
    //     Bucket: bucketName,
    //     Key: fileName,
    //     VersionId: versionId
    // } : {
    //     Bucket: bucketName,
    //     Key: fileName
    // };

    const result = await getS3(region).getObject({
        Bucket: bucketName,
        Key: fileName,
        VersionId: versionId
    }).promise();

    return {
        versionId: result.VersionId,
        isLatest: result.IsLatest,
        size: result.ContentLength,
        modifiedOn: result.LastModified,
        content: result.Body.toString()
    };

};

export const s3GetObject = async (bucketName: string, fileName: string, versionId?: string, region?: string): Promise<Record<string, any> | null> => {
    const result = await getS3(region)(bucketName, fileName, versionId);
    return {
        versionId: result.versionId,
        size: result.size,
        modifiedOn: result.modifiedOn,
        content: isNonEmptyString(result.content) ? JSON.parse(result.content) : null
    };
};

export const s3Delete = async (bucketName: string, fileName: string, region?: string) => {
    return new Promise(function (resolve, reject) {
        getS3(region).deleteObject({
            Bucket: bucketName,
            Key: fileName
        },
            function (err: any, url: string) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(url);
                }
            });
    });
};


export const s3SignedUrl = async (bucketName: string, fileName: string,
    acl: 'public-read-write',
    expires: 3600,
    region?: string
) => {

    return await getS3(region).getSignedUrlPromise('putObject',
        {
            Bucket: bucketName,
            Key: fileName,
            Expires: expires,
            ACL: acl,
            ContentType: getContentType(fileName)
        })
}