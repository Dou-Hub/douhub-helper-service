
//  COPYRIGHT:       PrimeObjects Software Inc. (C) 2021 All Right Reserved
//  COMPANY URL:     https://www.primeobjects.com/
//  CONTACT:         developer@primeobjects.com
// 
//  This source is subject to the PrimeObjects License Agreements. 
// 
//  Our EULAs define the terms of use and license for each PrimeObjects product. 
//  Whenever you install a PrimeObjects product or research PrimeObjects source code file, you will be prompted to review and accept the terms of our EULA. 
//  If you decline the terms of the EULA, the installation should be aborted and you should remove any and all copies of our products and source code from your computer. 
//  If you accept the terms of our EULA, you must abide by all its terms as long as our technologies are being employed within your organization and within your applications.
// 
//  THIS CODE AND INFORMATION IS PROVIDED "AS IS" WITHOUT WARRANTY
//  OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING BUT NOT
//  LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
//  FITNESS FOR A PARTICULAR PURPOSE.
// 
//  ALL OTHER RIGHTS RESERVED

import _ from './base';

export const getFileVersions = async (name, fileName) => {

    var params = {
        Bucket: `${process.env.RESOURCE_PREFIX}-${name.toLowerCase()}`,
        Prefix: fileName
    };

    const result = (await _.s3.listObjectVersions(params).promise()).Versions;
    return _.map(result, (r) => {
        return {
            versionId: r.VersionId,
            isLatest: r.IsLatest,
            size: r.Size,
            modifiedOn: r.LastModified,
            detail: r
        };
    });
};

export const uploadFile = async (name, fileName, content, showVersionHistory) => {

    const bucketName = `${process.env.RESOURCE_PREFIX}-${name.toLowerCase()}`;
    await _.s3PutObject(bucketName, fileName, content);
   
    if (showVersionHistory) {
        return await getFileVersions(name, fileName);
    }
    else {
        return await getFileMetadata(name, fileName);
    }
};


export const signedUrl = async (name, fileName, expires, params) => {

    const s3Bucket = `${process.env.RESOURCE_PREFIX}-${name.toLowerCase()}`;

    return await _.s3.getSignedUrlPromise('getObject',
        _.assign({
            Bucket: s3Bucket, Key: fileName,
            Expires: _.isNumber(expires) ? expires : 3600 //seconds = 1 hour
        }, params));

};
